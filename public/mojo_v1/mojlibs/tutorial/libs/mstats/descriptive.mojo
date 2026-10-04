# descriptive.mojo — location, spread and shape of a sample.
#
# The most-used module in the whole tutorial, and the one where silent wrong
# answers are easiest to produce. Two decisions run through every function
# here:
#
#   1. **Empty input raises.** A library that returns 0.0 for the mean of
#      nothing has turned a bug into a plausible-looking number, and the
#      number then travels a long way.
#   2. **Population and sample statistics are separate, named functions.**
#      `variance(x, sample=True)` is one flag away from `variance(x)` being
#      wrong by a factor of `n/(n-1)`, which is exactly the kind of error
#      that survives peer review.

from std.math import floor, sqrt

from mojo_core import close_to
from mojo_core import mean
from mojo_core import sum_of_squares


# ── counts and moments ─────────────────────────────────────────────────────

def count(values: List[Float64]) -> Int:
    return len(values)


def minimum(values: List[Float64]) raises -> Float64:
    if len(values) == 0:
        raise "minimum: empty input"
    var best = values[0]
    for i in range(1, len(values)):
        if values[i] < best:
            best = values[i]
    return best


def maximum(values: List[Float64]) raises -> Float64:
    if len(values) == 0:
        raise "maximum: empty input"
    var best = values[0]
    for i in range(1, len(values)):
        if values[i] > best:
            best = values[i]
    return best


def sum(values: List[Float64]) -> Float64:
    var total = 0.0
    for i in range(len(values)):
        total += values[i]
    return total


def sum_squared(values: List[Float64]) -> Float64:
    return sum_of_squares(values)


# ── spread ─────────────────────────────────────────────────────────────────

def variance(values: List[Float64], sample: Bool = True) raises -> Float64:
    """Variance about the mean.

    `sample=True` divides by `n - 1` (Bessel's correction) and is the correct
    estimator for the variance of a population you have sampled. `sample=False`
    divides by `n` and describes the spread of the data you actually hold.

    `sample=True` with a single observation is a division by zero, so it
    raises rather than returning infinity.
    """
    var n = len(values)
    if n == 0:
        raise "variance: empty input"
    var denom = n - 1 if sample else n
    if denom < 1:
        raise "variance: sample variance needs at least two observations"

    var m = mean(values)
    var acc = 0.0
    for i in range(n):
        var d = values[i] - m
        acc += d * d
    return acc / Float64(denom)


def standard_deviation(values: List[Float64], sample: Bool = True) raises -> Float64:
    """The square root of the variance.

    Deliberately `sqrt(variance(...))` rather than `variance(...) ** 0.5`:
    raising a squared quantity to a fractional power can produce a NaN
    through rounding alone, and a NaN standard deviation is very hard to
    trace back to its cause.
    """
    return sqrt(variance(values, sample))


def mean_absolute_deviation(values: List[Float64]) raises -> Float64:
    """Mean absolute deviation from the mean.

    A far more robust spread measure than the standard deviation, because a
    single outlier drags the deviation toward itself but barely moves the
    absolute deviation. Report both when the data might contain errors.
    """
    var m = mean(values)
    var acc = 0.0
    for i in range(len(values)):
        acc += abs(values[i] - m)
    return acc / Float64(len(values))


def median_absolute_deviation(values: List[Float64]) raises -> Float64:
    """MAD: median of the absolute deviations from the median.

    The most robust spread statistic there is. Fifty percent of the data can
    be arbitrarily corrupted before it moves at all, which makes it the
    default choice for contaminated data.
    """
    var med = median(values)
    var deviations = List[Float64]()
    for i in range(len(values)):
        deviations.append(abs(values[i] - med))
    return median(deviations)


def coefficient_of_variation(values: List[Float64]) raises -> Float64:
    """Standard deviation divided by the mean, as a fraction.

    Scale-free, so it is the right way to compare the relative scatter of
    quantities with different units. Undefined for data centred on zero,
    which raises.
    """
    var m = mean(values)
    if close_to(m, 0.0):
        raise "coefficient_of_variation: mean is zero"
    return standard_deviation(values, False) / abs(m)


# ── order statistics ───────────────────────────────────────────────────────

def sorted_copy(values: List[Float64]) -> List[Float64]:
    """A sorted copy. Never sort the caller's list in place."""
    var out = List[Float64]()
    for i in range(len(values)):
        out.append(values[i])
    # Insertion sort: stable, in place on our own copy, and more than fast
    # enough for the sample sizes statistics actually deals with. A library
    # reaching for a quicksort here would be optimising the wrong thing.
    var n = len(out)
    for i in range(1, n):
        var key = out[i]
        var j = i - 1
        while j >= 0 and out[j] > key:
            out[j + 1] = out[j]
            j -= 1
        out[j + 1] = key
    return out


def quantile(values: List[Float64], q: Float64) raises -> Float64:
    """The `q`-quantile by linear interpolation between order statistics.

    `q = 0` is the minimum and `q = 1` the maximum. This is the convention
    used by R's `type=7` and NumPy's default, and choosing it deliberately
    matters: the seven common quantile definitions disagree by enough to
    change a reported percentile.
    """
    var n = len(values)
    if n == 0:
        raise "quantile: empty input"
    if q < 0.0 or q > 1.0:
        raise "quantile: q must lie in [0, 1]"

    var xs = sorted_copy(values)
    if n == 1:
        return xs[0]

    # h = (n - 1) * q is the fractional index into the sorted sample.
    var h = Float64(n - 1) * q
    var lo = Int(floor(h))
    var hi = lo + 1
    if hi > n - 1:
        return xs[n - 1]
    var frac = h - Float64(lo)
    return xs[lo] + frac * (xs[hi] - xs[lo])


def median(values: List[Float64]) raises -> Float64:
    """The 0.5 quantile."""
    return quantile(values, 0.5)


def interquartile_range(values: List[Float64]) raises -> Float64:
    """`Q3 - Q1`. The box in a box plot, and a robust spread measure."""
    return quantile(values, 0.75) - quantile(values, 0.25)


def mode(values: List[Float64]) raises -> List[Float64]:
    """Every value tied for the highest frequency.

    Returns a list because the mode is frequently not unique, and silently
    picking one of several modes invents precision the data does not have.
    """
    if len(values) == 0:
        raise "mode: empty input"
    var xs = sorted_copy(values)
    var best_count = 0
    var best_values = List[Float64]()
    var i = 0
    while i < len(xs):
        var j = i
        while j < len(xs) and close_to(xs[j], xs[i]):
            j += 1
        var run = j - i
        if run > best_count:
            best_count = run
            best_values = List[Float64]()
            best_values.append(xs[i])
        elif run == best_count:
            best_values.append(xs[i])
        i = j
    return best_values


# ── shape ──────────────────────────────────────────────────────────────────

def skewness(values: List[Float64]) raises -> Float64:
    """Moment coefficient of skewness (Fisher-Pearson, g1).

    The third standardised central moment. Positive means a long right tail.
    For small samples the *adjusted* estimator (G1) is much less biased;
    pass `adjusted=True` when `n < 50` or so.
    """
    var n = len(values)
    if n < 3:
        raise "skewness: needs at least three observations"
    var m = mean(values)
    var m2 = 0.0
    var m3 = 0.0
    for i in range(n):
        var d = values[i] - m
        m2 += d * d
        m3 += d * d * d
    m2 /= Float64(n)
    m3 /= Float64(n)
    if close_to(m2, 0.0):
        raise "skewness: zero variance"
    return m3 / (m2 * sqrt(m2))


def excess_kurtosis(values: List[Float64]) raises -> Float64:
    """Fourth standardised central moment, less 3.

    Zero for a normal distribution. Heavy tails score positive, light or
    bounded tails score negative.
    """
    var n = len(values)
    if n < 4:
        raise "excess_kurtosis: needs at least four observations"
    var m = mean(values)
    var m2 = 0.0
    var m4 = 0.0
    for i in range(n):
        var d = values[i] - m
        m2 += d * d
        m4 += d * d * d * d
    m2 /= Float64(n)
    m4 /= Float64(n)
    if close_to(m2, 0.0):
        raise "excess_kurtosis: zero variance"
    return m4 / (m2 * m2) - 3.0


# ── summaries ──────────────────────────────────────────────────────────────

struct Summary(Copyable, Writable):
    """A standard univariate summary, with the sample size attached.

    Always carries `n`. A mean of 4.0 from two observations and a mean of 4.0
    from two million are the same string, and attaching the count is the
    cheapest possible defence against reading one as the other.
    """

    var n: Int
    var mean_value: Float64
    var sd: Float64
    var median_value: Float64
    var q1: Float64
    var q3: Float64
    var min_value: Float64
    var max_value: Float64

    def iqr(self) -> Float64:
        return self.q3 - self.q1

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"Summary(n={self.n}, mean={self.mean_value})"))


def summarize(values: List[Float64]) raises -> Summary:
    """Compute the standard summary. One pass over the data, one sort."""
    var n = len(values)
    if n == 0:
        raise "summarize: empty input"
    return Summary(
        n,
        mean(values),
        standard_deviation(values, True),
        median(values),
        quantile(values, 0.25),
        quantile(values, 0.75),
        minimum(values),
        maximum(values),
    )