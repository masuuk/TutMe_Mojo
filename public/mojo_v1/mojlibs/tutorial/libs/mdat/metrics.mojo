# metrics.mojo — the measures that turn a series into a performance claim.
#
# Aggregation is a choice about what counts. Mean revenue and median revenue
# answer different questions, and a quarter's numbers are usually quoted
# with whichever is more flattering. Every function here takes a list and
# returns one number, so the choice is forced to be explicit at the call
# site.
#
# The pairings that matter:
#
#   * mean and median          -- central tendency, robust or not
#   * mean and geometric mean  -- growth rates, where only one compounds
#   * level and change         -- a level says nothing without a trend
#   * percentiles and MAD      -- spread that survives an outlier
#
# Nothing here is a forecast. A metric computed over a window describes that
# window and nothing else, and the temptation to read it as a property of the
# process is the most expensive habit in analytics.

from std.math import abs, exp, log, sqrt

from mojo_core import close_to
from mojo_core import mean
from .clean import drop_missing
from .clean import median_of
from .clean import quantile_of


def coverage(values: List[Float64]) -> Float64:
    """The fraction of observations that are not missing.

    The first metric to check on any dataset and the one most often skipped.
    A mean over 12% of a series is not a mean of the series; it is a mean of
    whichever part happened to be recorded, and which part that is usually
    not random.
    """
    if len(values) == 0:
        return 0.0
    return Float64(len(drop_missing(values))) / Float64(len(values))


# ── central tendency ────────────────────────────────────────────────────────

def level_mean(values: List[Float64]) raises -> Float64:
    """The arithmetic mean of the present observations."""
    var present = drop_missing(values)
    if len(present) == 0:
        raise "level_mean: every observation is missing"
    return mean(present)


def level_median(values: List[Float64]) raises -> Float64:
    """The median of the present observations."""
    var present = drop_missing(values)
    if len(present) == 0:
        raise "level_median: every observation is missing"
    return median_of(present)


def level_trimmed_mean(
    values: List[Float64], proportion: Float64 = 0.1
) raises -> Float64:
    """The mean after discarding `proportion` from each tail.

    The compromise between the mean and the median: it uses every
    observation's magnitude, so it keeps more information than the median,
    while ignoring the extreme `2 * proportion` that would otherwise dominate
    a small sample.
    """
    var n = len(values)
    if proportion < 0.0 or proportion >= 0.5:
        raise "level_trimmed_mean: proportion must lie in [0, 0.5)"
    var present = drop_missing(values)
    var m = len(present)
    if m == 0:
        raise "level_trimmed_mean: every observation is missing"

    var cut = Int(Float64(m) * proportion)
    if m - 2 * cut < 1:
        raise "level_trimmed_mean: trimming would remove every observation"

    # `drop_missing` preserves input order, so the sort has to happen here
    # rather than being inherited from a helper that was called for a
    # different reason.
    var ordered = sorted_floats(present)
    var total = 0.0
    for i in range(cut, m - cut):
        total += ordered[i]
    return total / Float64(m - 2 * cut)


def sorted_floats(values: List[Float64]) -> List[Float64]:
    var out = List[Float64]()
    for i in range(len(values)):
        out.append(values[i])
    for i in range(1, len(out)):
        var key = out[i]
        var j = i - 1
        while j >= 0 and out[j] > key:
            out[j + 1] = out[j]
            j -= 1
        out[j + 1] = key
    return out


# ── dispersion ──────────────────────────────────────────────────────────────

def spread_std(values: List[Float64]) raises -> Float64:
    """Sample standard deviation of the present observations."""
    var present = drop_missing(values)
    if len(present) < 2:
        raise "spread_std: need at least two non-missing observations"
    var m = mean(present)
    var acc = 0.0
    for i in range(len(present)):
        var d = present[i] - m
        acc += d * d
    return sqrt(acc / Float64(len(present) - 1))


def spread_mad(values: List[Float64]) raises -> Float64:
    """Median absolute deviation. Unmoved by an extreme value; the sd is not."""
    var present = drop_missing(values)
    if len(present) == 0:
        raise "spread_mad: every observation is missing"
    var med = median_of(present)
    var deviations = List[Float64]()
    for i in range(len(present)):
        deviations.append(abs(present[i] - med))
    return median_of(deviations)


def coefficient_of_variation(values: List[Float64]) raises -> Float64:
    """Standard deviation divided by the mean.

    Scale-free, so it is the right way to compare relative scatter across
    quantities of different size. Meaningless near zero mean, where it
    diverges, which is why it raises rather than returning a huge number.
    """
    var m = level_mean(values)
    if close_to(m, 0.0):
        raise "coefficient_of_variation: the mean is zero"
    return spread_std(values) / abs(m)


# ── shape over a window ─────────────────────────────────────────────────────

def percentiles(values: List[Float64]) raises -> Tuple[Float64, Float64, Float64]:
    """The 25th, 50th and 75th percentiles.

    The three numbers behind a box plot. Report them together: a median on
    its own says nothing about whether the data is concentrated around it or
    spread evenly across the whole range.
    """
    var present = drop_missing(values)
    if len(present) == 0:
        raise "percentiles: every observation is missing"
    return (
        quantile_of(present, 0.25),
        quantile_of(present, 0.50),
        quantile_of(present, 0.75),
    )


def interquartile_range(values: List[Float64]) raises -> Float64:
    """`Q3 - Q1`: the middle fifty percent of the data."""
    var p = percentiles(values)
    return p[2] - p[0]


def skewness(values: List[Float64]) raises -> Float64:
    """Moment coefficient of skewness.

    Positive means a long right tail. On operational metrics a positive
    value is almost always the interesting finding: mean latency hides a
    small population of catastrophic requests that the median never shows.
    """
    var present = drop_missing(values)
    var n = len(present)
    if n < 3:
        raise "skewness: need at least three non-missing observations"
    var m = mean(present)
    var m2 = 0.0
    var m3 = 0.0
    for i in range(n):
        var d = present[i] - m
        m2 += d * d
        m3 += d * d * d
    m2 /= Float64(n)
    m3 /= Float64(n)
    if close_to(m2, 0.0):
        raise "skewness: zero variance"
    return m3 / (m2 * sqrt(m2))


# ── change over time ────────────────────────────────────────────────────────

struct TrendReport(Copyable, Writable):
    """Direction, size, and quality of a linear trend.

    `r_squared` is on the report for a reason. A steep slope fitted to noise
    is the most common way to announce a trend that does not exist, and the
    slope alone cannot be distinguished from that case by looking at it.
    """

    var slope: Float64            # change per observation
    var intercept: Float64
    var r_squared: Float64
    var observations: Int

    @property
    def is_meaningful(self) -> Bool:
        return self.r_squared > 0.5

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"TrendReport(slope={self.slope}, r2={self.r_squared})"))


def trend(values: List[Float64]) raises -> TrendReport:
    """The least-squares line through `(0, v0), (1, v1), ...`.

    OLS rather than a Theil-Sen or a moving-difference trend, for one
    reason: it is the same arithmetic the reader can check, and the r2 it
    reports is the number that tells you whether to believe it.
    """
    var present = sorted_by_index(values)
    var n = len(present)
    if n < 3:
        raise "trend: need at least three non-missing observations"

    var m = mean(present)
    var sxx = 0.0
    var sxy = 0.0
    for i in range(n):
        var x = Float64(i)
        sxx += (x - Float64(n) / 2.0) * (x - Float64(n) / 2.0)
        sxy += (x - Float64(n) / 2.0) * (present[i] - m)
    if close_to(sxx, 0.0):
        raise "trend: not enough observations to fit a line"

    var slope = sxy / sxx
    var intercept = m - slope * Float64(n) / 2.0
    var sse = 0.0
    var sst = 0.0
    for i in range(n):
        var residual = present[i] - (intercept + slope * Float64(i))
        sse += residual * residual
        var d = present[i] - m
        sst += d * d
    var r2 = 0.0
    if not close_to(sst, 0.0):
        r2 = 1.0 - sse / sst
        if r2 < 0.0:
            r2 = 0.0
    return TrendReport(slope, intercept, r2, n)


def sorted_by_index(values: List[Float64]) -> List[Float64]:
    """Drop the missing observations, preserving order.

    Named for what it does rather than what it returns, because dropping
    shifts indices and any caller assuming otherwise will misalign a trend
    against a timeline.
    """
    return drop_missing(values)


def growth_rate(
    first: Float64, last: Float64, periods: Float64
) raises -> Float64:
    """The compound rate over `periods` intervals.

    The geometric rate, not `((last - first) / first) / periods`. The linear
    version ignores compounding entirely, which is the same mistake the
    finance chapter of this tutorial keeps warning about, appearing here in
    the data-analytics layer.
    """
    if first <= 0.0 or last <= 0.0:
        raise "growth_rate: both values must be positive"
    if periods <= 0.0:
        raise "growth_rate: periods must be positive"
    return exp(log(last / first) / periods) - 1.0


def index_to_base(values: List[Float64], base: Float64 = 100.0) raises -> List[Float64]:
    """Rescale a series so the first present value equals `base`.

    The standard way to compare two series on one axis, and the reason a
    chart of two metrics is readable at all. Raw levels with different
    units cannot share an axis, and plotting them together anyway is how
    charts end up showing a trend that is entirely a units artefact.
    """
    var present = drop_missing(values)
    if len(present) == 0:
        raise "index_to_base: every observation is missing"
    var out = List[Float64]()
    for i in range(len(values)):
        if values[i] != values[i]:
            out.append(values[i])
            continue
        out.append(base * values[i] / present[0])
    return out


# ── accuracy against a reference ────────────────────────────────────────────

struct ErrorReport(Copyable, Writable):
    """Every error measure for one forecast, side by side.

    Returned as one struct because the measures disagree, and choosing among
    them is the caller's decision. Reporting MAE alone invites a model that
    is usually right and occasionally catastrophic; reporting RMSE alone
    invites a model that is never right.
    """

    var mae: Float64
    var rmse: Float64
    var mape: Float64
    var bias: Float64

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"ErrorReport(mae={self.mae}, rmse={self.rmse})"))


def errors(actual: List[Float64], predicted: List[Float64]) raises -> ErrorReport:
    """MAE, RMSE, MAPE and mean bias for one forecast.

    Raises on a length mismatch, and on any zero in `actual` -- MAPE is
    unbounded there and dividing by a small number produces a percentage
    large enough to swamp the other three measures entirely.

    `bias` is reported separately because it is the only one of the four
    that can be zero while all the others are large. An RMSE of 10 with a
    bias of zero is a model that is wrong in both directions equally; the
    same RMSE with a bias of 9 is a model that is systematically over-
    predicting and fixable with a constant.
    """
    var n = len(actual)
    if n != len(predicted):
        raise "errors: actual and predicted must be the same length"
    if n == 0:
        raise "errors: nothing to compare"

    var sum_abs = 0.0
    var sum_sq = 0.0
    var sum_pct = 0.0
    var sum_bias = 0.0
    for i in range(n):
        if actual[i] == actual[i] or predicted[i] == predicted[i]:
            raise "errors: every observation and prediction must be present"
        if close_to(actual[i], 0.0):
            raise "errors: MAPE is undefined when the actual value is zero"
        var e = actual[i] - predicted[i]
        sum_abs += abs(e)
        sum_sq += e * e
        sum_pct += abs(e) / abs(actual[i])
        sum_bias += e

    var count = Float64(n)
    return ErrorReport(sum_abs / count, sqrt(sum_sq / count), sum_pct / count, sum_bias / count)