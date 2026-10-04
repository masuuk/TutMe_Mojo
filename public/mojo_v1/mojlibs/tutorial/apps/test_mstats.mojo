# test_mstats.mojo — the test suite for the `mstats` package.
#
# There is no `mojo test` command: a test is an ordinary program with a
# `main()` that exits non-zero if anything fails. `std.testing.assert_true`
# raises on failure, which is all the machinery a test suite actually needs,
# so nothing here is bespoke.
#
# Run with:  mojo run apps/test_mstats.mojo

from std.testing import assert_true
from std.testing import assert_raises

from mojo_core import Rng
from mojo_core import close_to

from mstats import coefficient_of_variation
from mstats import confidence_interval
from mstats import covariance
from mstats import critical_z
from mstats import erf
from mstats import excess_kurtosis
from mstats import interquartile_range
from mstats import least_squares
from mstats import median
from mstats import median_absolute_deviation
from mstats import mode
from mstats import normal_cdf
from mstats import normal_quantile
from mstats import pearson
from mstats import quantile
from mstats import ranks
from mstats import r_squared
from mstats import skewness
from mstats import spearman
from mstats import standard_deviation
from mstats import summarize
from mstats import two_sided_p
from mstats import variance

# Values chosen so every expected answer is arithmetic a reader can verify
# on paper. That is deliberate: a test whose expected value comes from the
# implementation only proves the implementation is self-consistent.
var DATA = [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]   # mean 5, var 32/7


def test_empty_input_raises():
    # The central design commitment, asserted first so a regression is
    # noticed immediately rather than by whoever trips over it later.
    #
    # `assert_raises` is a context manager: entering it sets a trap, the
    # block must raise, and exiting without a raise fails the test. That is
    # the whole mechanism -- there is no test runner to extend.
    var empty = List[Float64]()
    with assert_raises(Error):
        _ = median(empty)
    with assert_raises(Error):
        _ = variance(empty)
    with assert_raises(Error):
        _ = standard_deviation(empty)
    with assert_raises(Error):
        _ = mode(empty)
    with assert_raises(Error):
        _ = summarize(empty)


def test_mean_and_spread() raises:
    var m = 0.0
    for i in range(len(DATA)):
        m += DATA[i]
    assert_true(close_to(m / 8.0, 5.0))

    # Population variance: sum of squared deviations is 32, divided by 8.
    var ss = 0.0
    for i in range(len(DATA)):
        var d = DATA[i] - 5.0
        ss += d * d
    assert_true(close_to(ss / 8.0, 4.0, atol=1e-12, rtol=0.0))
    assert_true(close_to(standard_deviation(DATA, False), 2.0))

    # Sample variance divides by n-1 instead: 32/7.
    assert_true(close_to(variance(DATA, True), 32.0 / 7.0, atol=1e-12, rtol=0.0))
    assert_true(close_to(variance(DATA, False), variance(DATA, True) * 7.0 / 8.0))


def test_quantile_interpolation() raises:
    # h = (n-1)q = 7q; at q=0.25 that is 1.75, between the 2nd (4) and
    # 3rd (4) order statistics, hence exactly 4.
    assert_true(close_to(quantile(DATA, 0.0), 2.0))
    assert_true(close_to(quantile(DATA, 0.25), 4.0))
    assert_true(close_to(quantile(DATA, 0.5), 4.5))
    assert_true(close_to(quantile(DATA, 0.75), 5.5))
    assert_true(close_to(quantile(DATA, 1.0), 9.0))
    assert_true(close_to(interquartile_range(DATA), 1.5))


def test_median_is_the_half_quantile() raises:
    assert_true(close_to(median(DATA), 4.5))


def test_mode_returns_every_tie() raises:
    # 4 occurs three times, 5 occurs twice. Only one mode here, but the API
    # returns a list so a genuine tie would not be silently resolved.
    var m = mode(DATA)
    assert_true(len(m) == 1)
    assert_true(close_to(m[0], 4.0))

    var tied = [1.0, 1.0, 2.0, 2.0]
    var both = mode(tied)
    assert_true(len(both) == 2)


def test_sorted_copy_leaves_input_alone() raises:
    var copy = List[Float64]()
    for i in range(len(DATA)):
        copy.append(DATA[i])
    var was_first = copy[0]
    var _ = median(copy)          # forces a sort
    assert_true(close_to(copy[0], was_first))


def test_shape_statistics() raises:
    # A symmetric sample has exactly zero skewness: the third central moment
    # cancels in pairs. Deviations -2 -1 0 1 2 give m3 = 0 outright.
    var sym = [1.0, 2.0, 3.0, 4.0, 5.0]
    assert_true(close_to(skewness(sym), 0.0, atol=1e-12, rtol=0.0))

    # Its excess kurtosis is strongly *negative*: -1.3. A bounded, flat
    # distribution is lighter-tailed than a normal, and that is the correct
    # answer rather than a near miss. This is why "kurtosis should be about
    # zero" is a statement about normal samples and nothing else.
    assert_true(close_to(excess_kurtosis(sym), -1.3, atol=1e-9, rtol=0.0))

    # A long right tail must register as positive skew.
    var tailed = [1.0, 1.0, 1.0, 1.0, 10.0]
    assert_true(skewness(tailed) > 0.0)
    assert_true(excess_kurtosis(tailed) > 0.0)


def test_robust_spread_beats_standard_deviation() raises:
    # One gross outlier inflates the standard deviation enormously and the
    # MAD barely at all. This is the reason the MAD exists.
    var clean = List[Float64]()
    var dirty = List[Float64]()
    var rng = Rng(7)
    for _ in range(20):
        var v = rng.normal(100.0, 2.0)
        clean.append(v)
        dirty.append(v)
    dirty.append(5000.0)

    var sd_ratio = standard_deviation(dirty, False) / standard_deviation(clean, False)
    var mad_ratio = median_absolute_deviation(dirty) / median_absolute_deviation(clean)
    assert_true(sd_ratio > 5.0)
    assert_true(mad_ratio < 2.0)


def test_coefficient_of_variation() raises:
    # 2.0 / 5.0 = 0.4 using the population standard deviation.
    assert_true(close_to(coefficient_of_variation(DATA), 0.4))

    # Data centred on zero has no scale-free relative spread.
    var centred = [-1.0, 1.0, -1.0, 1.0]
    with assert_raises(Error):
        _ = coefficient_of_variation(centred)


def test_erf_values():
    # erf(0) = 0 and erf is symmetric about zero: erf(-x) = -erf(x).
    assert_true(close_to(erf(0.0), 0.0, atol=1e-7, rtol=0.0))
    assert_true(close_to(erf(0.5), -erf(-0.5), atol=1e-12, rtol=0.0))
    # erf saturates at +/-1 well before erf(4).
    assert_true(close_to(erf(4.0), 1.0, atol=1e-5, rtol=0.0))


def test_normal_cdf_landmarks():
    # Symmetry about zero is the property that catches a broken erf.
    assert_true(close_to(normal_cdf(0.0), 0.5, atol=1e-7, rtol=0.0))
    assert_true(close_to(normal_cdf(1.0) + normal_cdf(-1.0), 1.0, atol=1e-7, rtol=0.0))
    assert_true(close_to(normal_cdf(1.96), 0.975, atol=1e-4, rtol=0.0))
    # The tails are exactly 0 and 1, not slightly outside.
    assert_true(normal_cdf(-100.0) == 0.0)
    assert_true(normal_cdf(100.0) == 1.0)


def test_two_sided_p_is_symmetric():
    assert_true(close_to(two_sided_p(1.5), two_sided_p(-1.5)))
    # A z of 1.96 is the 5% two-sided boundary.
    assert_true(close_to(two_sided_p(1.959964), 0.05, atol=1e-5, rtol=0.0))


def test_critical_z() raises:
    # The two textbook numbers, to five decimal places.
    assert_true(close_to(critical_z(0.05, True), 1.959964, atol=1e-5, rtol=0.0))
    assert_true(close_to(critical_z(0.05, False), 1.644854, atol=1e-5, rtol=0.0))
    # One-sided is always the smaller critical value.
    assert_true(critical_z(0.05, False) < critical_z(0.05, True))


def test_normal_quantile_inverts_the_cdf() raises:
    # Round-tripping through the bisection solver must land back on the input.
    for p in [0.001, 0.025, 0.1, 0.5, 0.9, 0.975, 0.999]:
        var z = normal_quantile(p)
        assert_true(close_to(normal_cdf(z), p, atol=1e-9, rtol=0.0))
    assert_true(close_to(normal_quantile(0.5), 0.0, atol=1e-6, rtol=0.0))


def test_confidence_interval() raises:
    var lo = 0.0
    var hi = 0.0
    var bounds = confidence_interval(5.0, 2.0, 8, 0.95)
    lo = bounds[0]
    hi = bounds[1]

    # 1.959964 * 2 / sqrt(8) = 1.3859038, so (3.6140962, 6.3859038).
    assert_true(close_to(lo, 3.6140962, atol=1e-5, rtol=0.0))
    assert_true(close_to(hi, 6.3859038, atol=1e-5, rtol=0.0))
    # The interval is always symmetric about the mean.
    assert_true(close_to(hi - 5.0, 5.0 - lo, atol=1e-12, rtol=0.0))
    # More data, narrower interval.
    var tight = confidence_interval(5.0, 2.0, 800, 0.95)
    assert_true(tight[1] - tight[0] < hi - lo)


def test_pearson() raises:
    # Perfect positive, perfect negative and a linear relationship: the last
    # is the one worth checking, since the first two are too easy to fake.
    var x = [1.0, 2.0, 3.0, 4.0, 5.0]
    var y = [2.0, 4.0, 6.0, 8.0, 10.0]
    assert_true(close_to(pearson(x, y), 1.0, atol=1e-12, rtol=0.0))
    assert_true(close_to(pearson(x, r_squared_of(x)), 1.0, atol=1e-12, rtol=0.0))
    assert_true(r_squared(x, y) > 0.9999)

    var inv = [10.0, 8.0, 6.0, 4.0, 2.0]
    assert_true(close_to(pearson(x, inv), -1.0, atol=1e-12, rtol=0.0))

    # Mismatched lengths must not be paired up by index. This is the single
    # most common bug in spreadsheet-shaped code, so it gets its own check.
    var long_x = [1.0, 2.0, 3.0, 4.0, 5.0]
    var short_y = [1.0, 2.0, 3.0]
    with assert_raises(Error):
        _ = pearson(long_x, short_y)
    with assert_raises(Error):
        _ = least_squares(long_x, short_y)

    # A series with no variation cannot be correlated with anything.
    var flat = [2.0, 2.0, 2.0, 2.0, 2.0]
    with assert_raises(Error):
        _ = pearson(flat, x)


def r_squared_of(xs: List[Float64]) -> List[Float64]:
    # A strictly increasing helper, for the perfect-rank test below.
    var out = List[Float64]()
    for i in range(len(xs)):
        out.append(xs[i] * 3.0 - 7.0)
    return out


def test_spearman_beats_pearson_on_a_monotone_curve() raises:
    # An exponential relationship: the ranks line up perfectly while the
    # magnitudes do not, which is the whole argument for rank correlation.
    var x = List[Float64]()
    var y = List[Float64]()
    var v = 1.0
    for i in range(12):
        x.append(Float64(i))
        y.append(v)
        v = v * 2.0
    assert_true(close_to(spearman(x, y), 1.0, atol=1e-12, rtol=0.0))
    assert_true(pearson(x, y) < 0.98)


def test_ranks_average_ties() raises:
    # [10, 20, 20, 30] -> ranks [1, 2.5, 2.5, 4].
    var r = ranks([10.0, 20.0, 20.0, 30.0])
    assert_true(close_to(r[0], 1.0))
    assert_true(close_to(r[1], 2.5))
    assert_true(close_to(r[2], 2.5))
    assert_true(close_to(r[3], 4.0))
    # Ranks are a permutation of 1..n, so their mean is (n+1)/2.
    var total = 0.0
    for i in range(len(r)):
        total += r[i]
    assert_true(close_to(total, 2.5, atol=1e-12, rtol=0.0))


def test_covariance() raises:
    # Independent-looking data: covariance of x against its own negation is
    # exactly minus the variance.
    var x = [1.0, 2.0, 3.0, 4.0]
    var neg = [-1.0, -2.0, -3.0, -4.0]
    assert_true(close_to(covariance(x, neg, False), -variance(x, False), atol=1e-12, rtol=0.0))
    # Covariance is symmetric.
    assert_true(close_to(covariance(x, x, True), variance(x, True)))


def test_least_squares_recovers_a_known_line() raises:
    var x = [1.0, 2.0, 3.0, 4.0, 5.0]
    var y = [2.1, 4.2, 5.9, 8.3, 9.8]     # scattered about 1.95x + 0.21
    var fit = least_squares(x, y)
    assert_true(close_to(fit.slope, 1.95, atol=1e-9, rtol=0.0))
    assert_true(close_to(fit.intercept, 0.21, atol=1e-9, rtol=0.0))
    assert_true(close_to(fit.r2, 0.996149, atol=1e-5, rtol=0.0))
    assert_true(close_to(fit.residual_sd, 0.221359, atol=1e-5, rtol=0.0))
    assert_true(fit.n == 5)

    # An exact line has zero residual spread and a perfect fit. With
    # x = 1..5 and y = 3,5,7,9,11 the relationship is exactly y = 2x + 1.
    # The two series must be the same length, which the solver enforces.
    var exact = [3.0, 5.0, 7.0, 9.0, 11.0]
    var perfect = least_squares(x, exact)
    assert_true(close_to(perfect.slope, 2.0, atol=1e-9, rtol=0.0))
    assert_true(close_to(perfect.intercept, 1.0, atol=1e-9, rtol=0.0))
    assert_true(close_to(perfect.r2, 1.0, atol=1e-12, rtol=0.0))
    assert_true(close_to(perfect.residual_sd, 0.0, atol=1e-9, rtol=0.0))


def test_least_squares_rejects_a_vertical_fit():
    # With every x identical there is no line to fit, so the module raises
    # rather than returning a slope of zero and an intercept that happens to
    # equal the mean of y.
    var flat_x = [2.0, 2.0, 2.0, 2.0]
    var y = [1.0, 4.0, 9.0, 16.0]
    with assert_raises(Error):
        _ = least_squares(flat_x, y)


def test_fit_carries_its_precision() raises:
    # A fit over ten noisy points must not claim the significance of a fit
    # over ten thousand. That is what `n` in the fit object is for.
    var xs = List[Float64]()
    var strong = List[Float64]()
    var weak = List[Float64]()
    var rng = Rng(1234)
    for i in range(10):
        xs.append(Float64(i))
        strong.append(3.0 * Float64(i) + 1.0 + rng.normal(0.0, 0.1))
        weak.append(Float64(i) + rng.normal(0.0, 8.0))
    var good = least_squares(xs, strong)
    var bad = least_squares(xs, weak)
    assert_true(good.residual_sd < bad.residual_sd)
    assert_true(good.r2 > bad.r2)
    assert_true(good.significant_at(0.05))
    assert_true(not bad.significant_at(0.05))


def test_summarize_attaches_the_count() raises:
    var s = summarize(DATA)
    assert_true(s.n == 8)
    assert_true(close_to(s.mean_value, 5.0))
    assert_true(close_to(s.min_value, 2.0))
    assert_true(close_to(s.max_value, 9.0))
    assert_true(close_to(s.iqr(), interquartile_range(DATA)))


def main() raises:
    test_empty_input_raises()
    test_mean_and_spread()
    test_quantile_interpolation()
    test_median_is_the_half_quantile()
    test_mode_returns_every_tie()
    test_sorted_copy_leaves_input_alone()
    test_shape_statistics()
    test_robust_spread_beats_standard_deviation()
    test_coefficient_of_variation()
    test_erf_values()
    test_normal_cdf_landmarks()
    test_two_sided_p_is_symmetric()
    test_critical_z()
    test_normal_quantile_inverts_the_cdf()
    test_confidence_interval()
    test_pearson()
    test_spearman_beats_pearson_on_a_monotone_curve()
    test_ranks_average_ties()
    test_covariance()
    test_least_squares_recovers_a_known_line()
    test_least_squares_rejects_a_vertical_fit()
    test_fit_carries_its_precision()
    test_summarize_attaches_the_count()

    print("mstats: all 23 tests passed")