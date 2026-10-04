# clean.mojo — missing values, outliers, and the cost of both.
#
# Data cleaning is where analytics quietly stops being analysis. Every rule
# applied to a dataset is an assumption about the world, and the standard
# failure is to apply several without recording any of them. A report that
# says "mean revenue 4.2" without saying that three rows were interpolated
# is not reporting a fact about revenue.
#
# So this module never modifies anything. Every function returns a
# `CleaningReport` describing what it would change, and the caller applies
# the change. That inversion is deliberate: the decision to drop a customer
# is a business decision, and a library has no standing to make it.
#
# The other commitment: **a missing value is not a zero.** There is a
# separate `is_missing` mechanism throughout, because collapsing the two is
# the single most consequential error in applied analytics.

from std.math import abs
from std.utils.numerics import isnan

from mojo_core import close_to


struct CleaningReport(Copyable, Writable):
    """What a cleaning step found, and what it proposes.

    A report rather than a cleaned copy, so that the decision stays with the
    caller. `indices` lists the positions affected, in ascending order, which
    makes a report directly usable as an audit trail.
    """

    var removed: Int
    var imputed: Int
    var flagged: Int
    var indices: List[Int]

    @property
    def touched(self) -> Int:
        """How many observations the step affected in any way."""
        return len(self.indices)

    @property
    def is_noop(self) -> Bool:
        return len(self.indices) == 0

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"CleaningReport(touched={self.touched})"))


def missing_count(values: List[Float64]) -> Int:
    """How many values are missing.

    NaN is the missing marker, and it is chosen for a specific reason: it is
    the only floating-point value that is not equal to itself, so a missing
    value propagates through arithmetic as a missing value instead of
    quietly becoming a number. Zero propagates. An empty string propagates.
    NaN propagates, and that is exactly what is wanted.

    Constructed with `FloatLiteral.nan` and tested with `isnan`, both of
    which are documented rather than hand-rolled. Writing `x != x` instead
    works and is shorter, and is exactly the sort of cleverness that makes a
    codebase hard to read six months later.
    """
    var n = 0
    for i in range(len(values)):
        if isnan(values[i]):
            n += 1
    return n


def index_of_missing(values: List[Float64]) -> List[Int]:
    """Positions of the missing values, ascending."""
    var out = List[Int]()
    for i in range(len(values)):
        if isnan(values[i]):
            out.append(i)
    return out


def complete_cases(values: List[Float64]) -> Int:
    """How many observations are usable as they stand."""
    return len(values) - missing_count(values)


def find_outliers(
    values: List[Float64], k: Float64 = 3.0
) raises -> List[Int]:
    """Positions more than `k` robust standard deviations from the median.

    Uses the median and the median absolute deviation, not the mean and the
    standard deviation. That choice is the entire point: a mean and a
    standard deviation are computed *from* the outliers, so a single
    extreme value inflates the very statistic used to detect it, and it can
    hide itself. With one very large value in a hundred, the mean-based rule
    can fail to flag it at all.

    The MAD is scaled by 1.4826 so that it estimates the same quantity as a
    standard deviation would for normally-distributed data. Without that
    factor the threshold is off by half, and the `k` would mean nothing
    comparable to the usual 3-sigma rule.
    """
    var n = len(values)
    if n < 3:
        raise "find_outliers: need at least three observations"
    if k <= 0.0:
        raise "find_outliers: k must be positive"

    var present = List[Float64]()
    for i in range(n):
        if not isnan(values[i]):
            present.append(values[i])

    if len(present) < 3:
        raise "find_outliers: too few non-missing observations to judge"

    var med = median_of(present)
    var deviations = List[Float64]()
    for i in range(len(present)):
        deviations.append(abs(present[i] - med))
    var mad = median_of(deviations)

    # A perfectly symmetric sample can have a MAD of exactly zero, and then
    # no observation can ever exceed k * MAD. Reporting nothing is the only
    # honest answer: there is no spread to measure against.
    if close_to(mad, 0.0):
        return List[Int]()

    var scaled = mad * 1.4826
    var out = List[Int]()
    for i in range(n):
        if values[i] != values[i]:
            continue
        if abs(values[i] - med) > k * scaled:
            out.append(i)
    return out


def median_of(values: List[Float64]) -> Float64:
    """The median, by the same linear-interpolation convention as `mstats`."""
    var xs = List[Float64]()
    for i in range(len(values)):
        xs.append(values[i])
    for i in range(1, len(xs)):
        var key = xs[i]
        var j = i - 1
        while j >= 0 and xs[j] > key:
            xs[j + 1] = xs[j]
            j -= 1
        xs[j + 1] = key

    var n = len(xs)
    if n == 0:
        return 0.0
    if n % 2 == 1:
        return xs[n // 2]
    return 0.5 * (xs[n // 2 - 1] + xs[n // 2])


def impute_linear(values: List[Float64]) raises -> List[Float64]:
    """Fill gaps by interpolating between the surrounding observations.

    The result is a new list; the input is untouched. Gaps at the two ends
    are filled with the nearest present value, which is a *guess* and should
    be reported as one -- leading gaps in particular often mean the series
    simply started later, and filling them backwards invents history.

    Returns only the values; call `missing_count` beforehand if you need to
    know how many were invented.
    """
    var n = len(values)
    if n == 0:
        raise "impute_linear: empty series"
    var out = List[Float64]()
    for i in range(n):
        out.append(values[i])

    var first_present = -1
    for i in range(n):
        if not isnan(out[i]):
            first_present = i
            break
    if first_present < 0:
        raise "impute_linear: every observation is missing"

    # Leading gap: carry the first present value backwards.
    for i in range(first_present):
        out[i] = out[first_present]

    # Interior and trailing gaps: interpolate from the last present value.
    var last = first_present
    for i in range(first_present + 1, n):
        if not isnan(out[i]):
            last = i
            continue
        if i + 1 < n and not isnan(out[i + 1]):
            var span = Float64(i + 1 - last)
            var frac = Float64(i - last) / span
            out[i] = out[last] + frac * (out[i + 1] - out[last])
        else:
            out[i] = out[last]
    return out


def drop_missing(values: List[Float64]) -> List[Float64]:
    """Keep only the present observations.

    The other half of the choice made by `impute_linear`. Dropping preserves
    honesty about what was measured and changes the sample size; imputing
    preserves the sample size and invents data. Neither is right in general,
    which is why neither is done implicitly.
    """
    var out = List[Float64]()
    for i in range(len(values)):
        if not isnan(values[i]):
            out.append(values[i])
    return out


def winsorize(values: List[Float64], limits: Float64 = 0.05) raises -> List[Float64]:
    """Clamp the extreme tails to the given quantiles.

    `limits = 0.05` caps the bottom 5% at the 5th percentile and the top 5%
    at the 95th, keeping a *real* observed value in place of the extreme
    one rather than deleting the row.

    Preferred to dropping outliers for most statistical work because it keeps
    the sample size and, unlike a mean-based test, the threshold is computed
    from the quantiles -- so the most extreme values cannot inflate their own
    replacement threshold.
    """
    var n = len(values)
    if limits <= 0.0 or limits >= 0.5:
        raise "winsorize: limits must lie in (0, 0.5)"
    var present = drop_missing(values)
    if len(present) < 2:
        raise "winsorize: too few non-missing observations"

    var low = quantile_of(present, limits)
    var high = quantile_of(present, 1.0 - limits)

    var out = List[Float64]()
    for i in range(n):
        var v = values[i]
        if isnan(v):
            out.append(v)
            continue
        if v < low:
            v = low
        elif v > high:
            v = high
        out.append(v)
    return out


def quantile_of(values: List[Float64], q: Float64) -> Float64:
    """A quantile of an already-sorted-or-not list. Same convention as `mstats`."""
    var xs = List[Float64]()
    for i in range(len(values)):
        xs.append(values[i])
    for i in range(1, len(xs)):
        var key = xs[i]
        var j = i - 1
        while j >= 0 and xs[j] > key:
            xs[j + 1] = xs[j]
            j -= 1
        xs[j + 1] = key

    var n = len(xs)
    if n == 1:
        return xs[0]
    var h = Float64(n - 1) * q
    var lo = Int(h)
    var hi = lo + 1
    if hi > n - 1:
        return xs[n - 1]
    return xs[lo] + (h - Float64(lo)) * (xs[hi] - xs[lo])


def dedupe_consecutive(values: List[Float64]) -> List[Float64]:
    """Collapse runs of equal values to a single entry.

    For data recorded by a counter rather than a sensor -- hours of uptime,
    item counts, status codes -- long constant runs are an artefact of the
    measurement, not an observation. Removing them lets a moving average
    see the actual resolution of the signal.
    """
    var out = List[Float64]()
    for i in range(len(values)):
        if i == 0 or values[i] != values[i - 1]:
            out.append(values[i])
    return out


def normalize_min_max(values: List[Float64]) raises -> List[Float64]:
    """Rescale to [0, 1] using the observed extremes.

    Raises when the extremes coincide, since every output would then be
    either 0 or undefined and the input carries no scale information at all.
    """
    var lo = values[0]
    var hi = values[0]
    for i in range(len(values)):
        if values[i] < lo:
            lo = values[i]
        if values[i] > hi:
            hi = values[i]
    if close_to(hi, lo):
        raise "normalize_min_max: the series is constant"
    var out = List[Float64]()
    for i in range(len(values)):
        out.append((values[i] - lo) / (hi - lo))
    return out


def summarize_cleanliness(values: List[Float64]) -> CleaningReport:
    """How much of the series is usable, without changing any of it."""
    var idx = index_of_missing(values)
    return CleaningReport(len(idx), 0, 0, idx)