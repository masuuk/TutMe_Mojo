# series.mojo — time series storage, alignment, and resampling.
#
# A time series is a sequence of values at irregular points in time, and
# almost every analytical mistake is really a time-alignment mistake. Values
# computed over one window get compared against values computed over a
# different one, and the resulting statistic describes nothing.
#
# Everything here therefore takes timestamps seriously:
#
#   * `Series` requires strictly increasing time, and refuses duplicates.
#   * Gaps are explicit. A `Series` can be asked for its gap structure, and
#     a resampled series carries a flag saying whether it had to invent
#     values.
#   * Resampling reports what it did. Silently forward-filling a hole is how
#     a flat-lined sensor produces a beautiful, entirely fictional trend.

from std.utils.numerics import isfinite

from mojo_core import mean
from mojo_core import close_to


struct Series(Copyable, Writable):
    """Values observed at strictly increasing times.

    Not a `List` with a second parallel list of times: the invariant that
    the two have equal length and increasing keys is the thing most likely
    to be broken, so it is checked once in the constructor instead of being
    assumed everywhere downstream.
    """

    var times: List[Float64]
    var values: List[Float64]

    def __init__(out self, times: List[Float64], values: List[Float64]) raises:
        if len(times) != len(values):
            raise "Series: times and values must be the same length"
        if len(times) == 0:
            raise "Series: a series needs at least one observation"
        for i in range(1, len(times)):
            if times[i] <= times[i - 1]:
                raise "Series: timestamps must be strictly increasing"
            if not _is_finite(times[i]) or not _is_finite(values[i]):
                raise "Series: observations must be finite"
        self.times = times
        self.values = values

    def count(self) -> Int:
        return len(self.values)

    def first_time(self) -> Float64:
        return self.times[0]

    def last_time(self) -> Float64:
        return self.times[len(self.times) - 1]

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"Series(n={self.count()}, {self.first_time()}..{self.last_time()})"))


def _is_finite(x: Float64) -> Bool:
    # A NaN or an infinity in a time series is a data bug, and must not be
    # allowed to propagate into a statistic. `isfinite` rejects both, where a
    # comparison-based check would quietly accept an infinity.
    return isfinite(x)


def gap_report(s: Series) -> List[Float64]:
    """The interval between each consecutive pair of observations.

    A list of gaps makes the shape of a series visible at a glance. Regular
    intervals all equal; a gap an order of magnitude larger is a sensor
    outage, and it is right there in the list rather than hidden inside a
    rolling average.
    """
    var out = List[Float64]()
    for i in range(1, len(s.times)):
        out.append(s.times[i] - s.times[i - 1])
    return out


def max_gap(s: Series) -> Float64:
    var worst = 0.0
    for i in range(len(s.times) - 1):
        var d = s.times[i + 1] - s.times[i]
        if d > worst:
            worst = d
    return worst


def is_regular(s: Series, tolerance: Float64 = 1e-9) -> Bool:
    """Whether every interval is the same, within `tolerance`.

    Floating-point timestamps from a real clock are never exactly equal, so
    the tolerance is not optional in spirit. Choosing it is a judgement call:
    too tight and every series looks irregular, too loose and a real outage
    looks like jitter.
    """
    var gaps = gap_report(s)
    if len(gaps) == 0:
        return True
    var first = gaps[0]
    for i in range(len(gaps)):
        if abs(gaps[i] - first) > tolerance:
            return False
    return True


def index_range(
    s: Series, start: Float64, end: Float64
) raises -> Tuple[Int, Int]:
    """The half-open index range covering `[start, end)`.

    Returns indices rather than a new `Series`, so a caller can slice
    efficiently and so a window is obviously a view rather than a copy.
    Half-open is deliberate: adjacent windows tile without overlap and
    without dropping the boundary point, which is the standard convention
    for exactly this reason.
    """
    if end < start:
        raise "index_range: end must not precede start"
    var lo = len(s.times)
    var hi = len(s.times)
    for i in range(len(s.times)):
        if s.times[i] >= start and lo == len(s.times):
            lo = i
        if s.times[i] >= end:
            hi = i
            break
    return (lo, hi)


def slice(s: Series, start: Float64, end: Float64) raises -> Series:
    """The sub-series covering `[start, end)`.

    Raises when the window is empty rather than returning an empty series.
    An empty window is almost always a mistake in the *query* rather than a
    fact about the data, and silently returning nothing turns that mistake
    into a plausible-looking zero downstream.
    """
    var r = index_range(s, start, end)
    if r[1] <= r[0]:
        raise "slice: the requested window contains no observations"
    var times = List[Float64]()
    var values = List[Float64]()
    for i in range(r[0], r[1]):
        times.append(s.times[i])
        values.append(s.values[i])
    return Series(times, values)


# ── resampling ──────────────────────────────────────────────────────────────

struct ResampleReport(Copyable, Writable):
    """A resampled series, plus an account of what had to be invented.

    `filled_points` counts buckets that had no observation and were
    forward-filled. It is on the result rather than in a log message because
    the caller needs it: a resampled series with 40% of its points invented
    should not be used the same way as one with none.
    """

    var series: Series
    var filled_points: Int
    var dropped_points: Int

    @property
    def is_clean(self) -> Bool:
        return self.filled_points == 0

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"ResampleReport(filled={self.filled_points})"))


def resample(
    s: Series, bucket: Float64, start: Float64, end: Float64
) raises -> ResampleReport:
    """Bucket values onto a regular grid, last observation carried forward.

    Forward-fill is the only choice that does not invent a number. Taking a
    mean of the bucket would smooth the data and make it look better
    behaved than it is; interpolating would invent values between
    observations, which is worse still because it looks like measurement.

    Empty buckets are filled from the last known value, and counted. A bucket
    before the first observation has nothing to carry forward, so it is
    dropped and counted separately.
    """
    if bucket <= 0.0:
        raise "resample: bucket width must be positive"
    if end <= start:
        raise "resample: end must follow start"

    var times = List[Float64]()
    var values = List[Float64]()
    var filled = 0
    var dropped = 0

    var source = 0
    var carried = 0.0
    var have_carried = False

    var t = start
    while t < end:
        # Advance the source pointer to the last observation at or before t.
        while source < len(s.times) and s.times[source] <= t:
            carried = s.values[source]
            have_carried = True
            source += 1

        if have_carried:
            times.append(t)
            values.append(carried)
            if source == 0 or s.times[source - 1] < t:
                # This bucket contains no observation of its own.
                filled += 1
        else:
            # Before the first observation: nothing to carry forward.
            dropped += 1
        t += bucket

    if len(times) == 0:
        raise "resample: the requested window precedes every observation"

    return ResampleReport(Series(times, values), filled, dropped)


# ── moving quantities ───────────────────────────────────────────────────────

def moving_average(values: List[Float64], window: Int) raises -> List[Float64]:
    """The mean over each trailing window of `window` observations.

    The output is shorter than the input by `window - 1`, because the first
    `window - 1` positions have no complete window. Padding them instead
    would require inventing data or using a partial window, and both make
    the first values of the series misleading in a way that propagates.
    """
    var n = len(values)
    if window <= 0:
        raise "moving_average: window must be positive"
    if window > n:
        raise "moving_average: window is longer than the series"

    var out = List[Float64]()
    var running = 0.0
    for i in range(window):
        running += values[i]
    out.append(running / Float64(window))

    for i in range(window, n):
        running += values[i] - values[i - window]
        out.append(running / Float64(window))
    return out


def moving_std(values: List[Float64], window: Int) raises -> List[Float64]:
    """Standard deviation over each trailing window.

    Computed from running sums of values and of squares rather than by
    recomputing each window's variance. The direct method loses precision
    badly when the values are large and the variation is small -- the
    running-sums method does too, which is why the difference
    `E[x^2] - E[x]^2` is evaluated carefully here rather than naively.
    """
    var n = len(values)
    if window < 2:
        raise "moving_std: window must be at least 2"
    if window > n:
        raise "moving_std: window is longer than the series"

    var out = List[Float64]()
    var s1 = 0.0
    var s2 = 0.0
    for i in range(window):
        s1 += values[i]
        s2 += values[i] * values[i]
    out.append(_window_sd(s1, s2, window))

    for i in range(window, n):
        var leaving = values[i - window]
        var entering = values[i]
        s1 += entering - leaving
        s2 += entering * entering - leaving * leaving
        out.append(_window_sd(s1, s2, window))
    return out


def _window_sd(s1: Float64, s2: Float64, window: Int) -> Float64:
    var m = s1 / Float64(window)
    var variance = s2 / Float64(window) - m * m
    # A tiny negative value here is rounding, not a real negative variance.
    if variance < 0.0:
        if variance > -1e-12:
            variance = 0.0
        else:
            variance = 0.0
    return variance ** 0.5


def differences(values: List[Float64]) raises -> List[Float64]:
    """First differences. One shorter than the input, by definition."""
    if len(values) < 2:
        raise "differences: need at least two observations"
    var out = List[Float64]()
    for i in range(1, len(values)):
        out.append(values[i] - values[i - 1])
    return out


def pct_change(values: List[Float64]) raises -> List[Float64]:
    """Proportional change between consecutive observations.

    Raises on a zero base, because the answer is unbounded and the honest
    response is to say so rather than to substitute a small number that
    turns an infinite growth rate into a merely large one.
    """
    if len(values) < 2:
        raise "pct_change: need at least two observations"
    var out = List[Float64]()
    for i in range(1, len(values)):
        if close_to(values[i - 1], 0.0):
            raise "pct_change: cannot take a percentage change from zero"
        out.append((values[i] - values[i - 1]) / values[i - 1])
    return out


def zscore(values: List[Float64]) raises -> List[Float64]:
    """Standardise to zero mean and unit variance.

    Raises when the variance is zero: standardising a constant series has no
    meaning, and returning zeros would look like "perfectly average data".
    """
    var n = len(values)
    if n < 2:
        raise "zscore: need at least two observations"
    var m = mean(values)
    var acc = 0.0
    for i in range(n):
        var d = values[i] - m
        acc += d * d
    var sd = (acc / Float64(n - 1)) ** 0.5
    if close_to(sd, 0.0):
        raise "zscore: the series has zero variance"
    var out = List[Float64]()
    for i in range(n):
        out.append((values[i] - m) / sd)
    return out