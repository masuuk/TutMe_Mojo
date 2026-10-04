# test_mdat.mojo — the test suite for the `mdat` package.
#
# The theme here is honesty about data. Most of these tests exist to pin a
# decision the package makes explicitly -- NaN means missing, cleaning
# reports rather than acts, resampling counts what it invented -- so that a
# later change cannot quietly alter a number that was already published.
#
# Run with:  mojo run apps/test_mdat.mojo

from std.testing import assert_raises
from std.testing import assert_true
from std.utils.numerics import isnan

from mojo_core import close_to

from mdat import CleaningReport
from mdat import ErrorReport
from mdat import ResampleReport
from mdat import Series
from mdat import TrendReport
from mdat import coefficient_of_variation
from mdat import complete_cases
from mdat import coverage
from mdat import dedupe_consecutive
from mdat import differences
from mdat import drop_missing
from mdat import errors
from mdat import find_outliers
from mdat import gap_report
from mdat import growth_rate
from mdat import impute_linear
from mdat import index_range
from mdat import index_to_base
from mdat import interquartile_range
from mdat import is_regular
from mdat import level_mean
from mdat import level_median
from mdat import level_trimmed_mean
from mdat import max_gap
from mdat import median_of
from mdat import missing_count
from mdat import moving_average
from mdat import normalize_min_max
from mdat import pct_change
from mdat import percentiles
from mdat import quantile_of
from mdat import resample
from mdat import slice
from mdat import skewness
from mdat import spread_mad
from mdat import spread_std
from mdat import summarize_cleanliness
from mdat import trend
from mdat import winsorize
from mdat import zscore

comptime GAP: Float64 = FloatLiteral.nan


# ── series ──────────────────────────────────────────────────────────────────

def test_series_requires_ordered_time() raises:
    # The invariant that a parallel pair of lists cannot guarantee. If time
    # is not strictly increasing the series is not a series, and every
    # downstream window would be wrong in a way that is invisible.
    var good = Series([0.0, 1.0, 2.0], [10.0, 20.0, 30.0])
    assert_true(good.count() == 3)
    assert_true(good.first_time() == 0.0)
    assert_true(good.last_time() == 2.0)

    # Equal timestamps are as bad as decreasing ones.
    with assert_raises(Error):
        var _ = Series([0.0, 1.0, 1.0], [1.0, 2.0, 3.0])
    with assert_raises(Error):
        var _ = Series([2.0, 1.0, 0.0], [1.0, 2.0, 3.0])
    with assert_raises(Error):
        var _ = Series([0.0, 1.0], [1.0])
    with assert_raises(Error):
        var _ = Series([], [])


def test_series_rejects_non_finite_observations() raises:
    # An infinity in a series is as much a data bug as a NaN, and unlike NaN
    # it survives most comparisons, so it must be caught at the boundary.
    with assert_raises(Error):
        var _ = Series([0.0, 1.0], [1.0, FloatLiteral.infinity])
    with assert_raises(Error):
        var _ = Series([0.0, 1.0], [1.0, GAP])


def test_gaps_are_visible() raises:
    # Intervals of 5, 6, 1 and 8. The 8 is the interesting one: a sensor
    # outage that a rolling average would smooth into invisibility.
    var s = Series([0.0, 5.0, 11.0, 12.0, 20.0], [10.0, 20.0, 30.0, 40.0, 50.0])
    var gaps = gap_report(s)
    assert_true(len(gaps) == 4)
    assert_true(close_to(gaps[0], 5.0))
    assert_true(close_to(gaps[1], 6.0))
    assert_true(close_to(gaps[2], 1.0))
    assert_true(close_to(gaps[3], 8.0))
    assert_true(close_to(max_gap(s), 8.0))
    assert_true(not is_regular(s))

    var even = Series([0.0, 1.0, 2.0, 3.0], [1.0, 2.0, 3.0, 4.0])
    assert_true(is_regular(even))
    assert_true(close_to(max_gap(even), 1.0))


def test_index_range_is_half_open() raises:
    # Half-open `[start, end)` so that adjacent windows tile without overlap
    # and without dropping the shared boundary.
    var s = Series([0.0, 1.0, 2.0, 3.0, 4.0], [10.0, 20.0, 30.0, 40.0, 50.0])

    var r = index_range(s, 1.0, 3.0)
    assert_true(r[0] == 1)
    assert_true(r[1] == 3)
    assert_true(close_to(slice(s, 1.0, 3.0).values[0], 20.0))
    assert_true(close_to(slice(s, 1.0, 3.0).values[1], 30.0))
    assert_true(slice(s, 1.0, 3.0).count() == 2)

    # An empty window is a mistake in the query, not a fact about the data,
    # so it raises rather than returning nothing.
    with assert_raises(Error):
        var _ = slice(s, 10.0, 20.0)
    with assert_raises(Error):
        var _ = index_range(s, 3.0, 1.0)


def test_resample_reports_what_it_invented() raises:
    # Observations at 0, 5, 11, 12 and 20, resampled onto a 2-wide grid over
    # [0, 20). Ten buckets; only three carry an observation of their own, so
    # seven are forward-filled. The count is on the result because a series
    # that is 70% invented must not be used like one that is observed.
    var s = Series([0.0, 5.0, 11.0, 12.0, 20.0], [10.0, 20.0, 30.0, 40.0, 50.0])
    var r = resample(s, 2.0, 0.0, 20.0)

    assert_true(r.series.count() == 10)
    assert_true(close_to(r.series.values[0], 10.0))
    # Bucket at 8 still carries the observation from t = 0: forward-fill
    # repeats a real value rather than inventing an interpolation.
    assert_true(close_to(r.series.values[4], 10.0))
    # Bucket at 10 picks up the observation at t = 5, then 12 picks up t = 11.
    assert_true(close_to(r.series.values[5], 20.0))
    assert_true(close_to(r.series.values[6], 30.0))
    assert_true(not r.is_clean)


def test_resample_drops_what_it_cannot_fill() raises:
    # A window starting before the first observation has nothing to carry
    # forward. Inventing a value there would fabricate the history of the
    # series, so those buckets are dropped and counted separately.
    var s = Series([0.0, 5.0, 11.0, 12.0, 20.0], [10.0, 20.0, 30.0, 40.0, 50.0])
    var r = resample(s, 2.0, -4.0, 10.0)
    assert_true(r.dropped_points == 2)
    assert_true(r.series.first_time() == 0.0)
    assert_true(r.series.last_time() == 8.0)

    # A window entirely before the data is an error, not an empty result.
    with assert_raises(Error):
        var _ = resample(s, 2.0, -100.0, -90.0)
    with assert_raises(Error):
        var _ = resample(s, 0.0, 0.0, 20.0)
    with assert_raises(Error):
        var _ = resample(s, 2.0, 20.0, 0.0)


def test_moving_average_is_shorter_by_exactly_a_window() raises:
    # Window 3 over 1..5 gives the means of (1,2,3), (2,3,4) and (3,4,5).
    # Three outputs, not five: the first two positions have no complete
    # window, and padding them would make the start of the series misleading.
    var v = [1.0, 2.0, 3.0, 4.0, 5.0]
    var ma = moving_average(v, 3)
    assert_true(len(ma) == 3)
    assert_true(close_to(ma[0], 2.0))
    assert_true(close_to(ma[1], 3.0))
    assert_true(close_to(ma[2], 4.0))

    # A window equal to the series length gives exactly one value.
    assert_true(len(moving_average(v, 5)) == 1)
    with assert_raises(Error):
        var _ = moving_average(v, 6)
    with assert_raises(Error):
        var _ = moving_average(v, 0)


def test_moving_average_matches_a_direct_mean() raises:
    # The running-sum implementation is an optimisation, and an optimisation
    # that disagrees with the obvious version is worthless. Checked at every
    # position rather than only at the ends, where a stale accumulator would
    # be least visible.
    var v = [3.0, 7.0, 1.0, 9.0, 2.0, 8.0, 4.0]
    var fast = moving_average(v, 3)
    for i in range(len(fast)):
        var direct = 0.0
        for j in range(i, i + 3):
            direct += v[j]
        assert_true(close_to(fast[i], direct / 3.0))


def test_differences_and_percentage_change() raises:
    assert_true(close_to(differences([1.0, 4.0, 6.0])[0], 3.0))
    assert_true(close_to(differences([1.0, 4.0, 6.0])[1], 2.0))
    assert_true(len(differences([1.0, 2.0, 3.0])) == 2)

    # Growth is proportional, so a change from a zero base is unbounded and
    # the honest answer is to refuse rather than substitute a small number.
    assert_true(close_to(pct_change([100.0, 110.0, 121.0])[0], 0.10))
    with assert_raises(Error):
        var _ = pct_change([100.0, 0.0])
    with assert_raises(Error):
        var _ = pct_change([1.0])


def test_zscore_standardises_and_refuses_constants() raises:
    var z = zscore([2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0])
    assert_true(len(z) == 8)
    # The standardised series has mean zero by construction.
    var total = 0.0
    for i in range(len(z)):
        total += z[i]
    assert_true(close_to(total / 8.0, 0.0, atol=1e-12, rtol=0.0))

    # Standardising a constant series has no meaning. Returning zeros would
    # look like perfectly average data, which is the opposite of the truth.
    with assert_raises(Error):
        var _ = zscore([5.0, 5.0, 5.0])


# ── missing values ──────────────────────────────────────────────────────────

def test_missing_is_not_zero() raises:
    # Two gaps in five observations. If missing were zero the mean would be
    # 2.6; because missing is absent, the mean of what was actually observed
    # is 3.0. The whole design of this package is that these cannot be
    # confused for one another.
    var v = [1.0, GAP, 3.0, GAP, 5.0]
    assert_true(missing_count(v) == 2)
    assert_true(complete_cases(v) == 3)
    assert_true(close_to(coverage(v), 0.6))

    # The same list with the gaps filled by zero gives a different and wrong
    # answer, which is precisely why NaN is the marker.
    var zeros = [1.0, 0.0, 3.0, 0.0, 5.0]
    assert_true(missing_count(zeros) == 0)
    assert_true(close_to(level_mean(v), 3.0))
    assert_true(close_to(level_mean(zeros), 1.8))


def test_drop_and_impute_are_the_two_halves_of_a_choice() raises:
    var v = [1.0, GAP, 3.0, GAP, 5.0]

    # Dropping preserves what was measured and changes the sample size.
    var kept = drop_missing(v)
    assert_true(len(kept) == 3)
    assert_true(close_to(kept[0], 1.0))
    assert_true(close_to(kept[2], 5.0))

    # Interpolating preserves the sample size and invents data. The interior
    # gaps sit exactly halfway between their neighbours.
    var filled = impute_linear(v)
    assert_true(len(filled) == 5)
    assert_true(missing_count(filled) == 0)
    assert_true(close_to(filled[1], 2.0))
    assert_true(close_to(filled[3], 4.0))

    # The original is untouched. Cleaning is a proposal, and this is the
    # observable consequence of that.
    assert_true(missing_count(v) == 2)


def test_impute_leading_gaps_are_carried_forward_not_invented() raises:
    # With no earlier observation to interpolate between, the honest fill is
    # the first known value. Extrapolating backwards would invent a trend
    # the data does not contain.
    var v = [GAP, GAP, 10.0, 20.0]
    var filled = impute_linear(v)
    assert_true(close_to(filled[0], 10.0))
    assert_true(close_to(filled[1], 10.0))
    assert_true(close_to(filled[2], 10.0))

    with assert_raises(Error):
        var _ = impute_linear([GAP, GAP])


def test_cleaning_reports_rather_than_acts() raises:
    # The report is the product. Deciding to drop a customer is a business
    # decision, and a library has no standing to make it silently.
    var v = [1.0, GAP, 3.0, GAP, 5.0]
    var report = summarize_cleanliness(v)
    assert_true(report.touched == 2)
    assert_true(not report.is_noop)
    assert_true(report.indices[0] == 1)
    assert_true(report.indices[1] == 3)

    var clean = summarize_cleanliness([1.0, 2.0, 3.0])
    assert_true(clean.is_noop)
    assert_true(clean.touched == 0)


def test_robust_outlier_rule_beats_the_naive_one() raises:
    # Nine observations between 10 and 14, and one of 1000.
    #
    # The mean lands at 110.8 and the sample standard deviation at 312.4, so
    # three sigmas is a band of 937 and the 1000 falls *inside* it. The mean
    # based rule cannot find the most extreme value in the dataset, because
    # the value has already dragged the mean and inflated the spread it is
    # being tested against. The robust rule uses the median (12) and the MAD
    # (1), giving a threshold of 3 * 1.4826 = 4.4 and flagging it.
    var v = [10.0, 12.0, 11.0, 13.0, 12.0, 11.0, 14.0, 13.0, 12.0, 1000.0]
    var found = find_outliers(v, 3.0)
    assert_true(len(found) == 1)
    assert_true(found[0] == 9)

    # And the naive arithmetic, spelled out, to show the failure is real.
    var m = 110.8
    var total = 0.0
    for i in range(len(v)):
        var d = v[i] - m
        total += d * d
    var sd = (total / 9.0) ** 0.5
    assert_true(close_to(sd, 312.435, atol=1e-2, rtol=0.0))
    assert_true(abs(1000.0 - m) < 3.0 * sd)


def test_outlier_detection_needs_spread_to_measure_against() raises:
    # With a median absolute deviation of exactly zero, no observation can
    # exceed any multiple of it. Reporting nothing is the only honest answer:
    # there is no spread to measure against.
    var flat = [10.0] * 8 + [1000.0]
    assert_true(len(find_outliers(flat, 3.0)) == 0)

    # A tighter k is stricter, and a wider one more forgiving.
    var v = [10.0, 12.0, 11.0, 13.0, 12.0, 11.0, 14.0, 13.0, 12.0, 1000.0]
    assert_true(len(find_outliers(v, 1000.0)) == 0)

    # Missing values are skipped rather than treated as extreme.
    var with_gap = [10.0, 12.0, 11.0, 13.0, 12.0, 11.0, 14.0, 13.0, 12.0, GAP]
    assert_true(len(find_outliers(with_gap, 3.0)) == 0)

    with assert_raises(Error):
        var _ = find_outliers([1.0, 2.0], 3.0)
    with assert_raises(Error):
        var _ = find_outliers(v, 0.0)


def test_winsorize_keeps_the_row_and_a_real_value() raises:
    # Clamping to the observed quantiles rather than deleting the row keeps
    # the sample size, and the replacement is itself a measurement.
    var v = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 100.0]
    var w = winsorize(v, 0.1)
    assert_true(len(w) == 9)
    assert_true(close_to(w[8], quantile_of(v, 0.9)))

    # Missing positions stay missing rather than becoming the low quantile.
    var with_gap = [1.0, GAP, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 100.0]
    var wg = winsorize(with_gap, 0.1)
    assert_true(isnan(wg[1]))

    with assert_raises(Error):
        var _ = winsorize(v, 0.0)
    with assert_raises(Error):
        var _ = winsorize(v, 0.5)


def test_dedupe_and_normalise() raises:
    # A counter recording hours of uptime produces long constant runs that
    # are an artefact of the measurement, not observations.
    var runs = [1.0, 1.0, 1.0, 2.0, 2.0, 3.0]
    var deduped = dedupe_consecutive(runs)
    assert_true(len(deduped) == 3)
    assert_true(close_to(deduped[1], 2.0))

    var scaled = normalize_min_max([2.0, 4.0, 6.0])
    assert_true(close_to(scaled[0], 0.0))
    assert_true(close_to(scaled[1], 0.5))
    assert_true(close_to(scaled[2], 1.0))

    # A constant series carries no scale information at all.
    with assert_raises(Error):
        var _ = normalize_min_max([3.0, 3.0, 3.0])


# ── metrics ─────────────────────────────────────────────────────────────────

def test_levels_and_the_choice_between_them() raises:
    var v = [10.0, 12.0, 11.0, 13.0, 12.0, 14.0, 11.0, 13.0, 12.0, 15.0]
    assert_true(close_to(level_mean(v), 12.3))
    assert_true(close_to(level_median(v), 12.0))

    # The trimmed mean sits between them: it drops the lowest and the
    # highest, then averages what is left.
    assert_true(close_to(level_trimmed_mean(v, 0.1), 12.25))
    assert_true(level_trimmed_mean(v, 0.1) <= level_mean(v))
    assert_true(level_trimmed_mean(v, 0.1) >= level_median(v))

    with assert_raises(Error):
        var _ = level_trimmed_mean(v, 0.5)


def test_percentiles_agree_with_each_other() raises:
    # Sorted: 10 11 11 12 12 12 13 13 14 15. Q1 sits a quarter of the way
    # from index 2 to 3, so 11 + 0.25 = 11.25. Q3 sits three quarters from
    # index 6 to 7, and both of those are 13.
    var v = [10.0, 12.0, 11.0, 13.0, 12.0, 14.0, 11.0, 13.0, 12.0, 15.0]
    var p = percentiles(v)
    assert_true(close_to(p[0], 11.25))
    assert_true(close_to(p[1], 12.0))
    assert_true(close_to(p[2], 13.0))
    assert_true(close_to(interquartile_range(v), 1.75))

    # The middle fifty percent, by definition.
    assert_true(interquartile_range(v) <= level_trimmed_mean(v, 0.1))


def test_spread_measures() raises:
    var v = [10.0, 12.0, 11.0, 13.0, 12.0, 14.0, 11.0, 13.0, 12.0, 15.0]

    # Deviations from 12.3 square to 5.29 .09 1.69 .49 .09 2.89 1.69 .49 .09
    # 7.29, summing to 20.10 over nine degrees of freedom.
    assert_true(close_to(spread_std(v), 1.494434, atol=1e-5, rtol=0.0))
    assert_true(close_to(spread_mad(v), 1.0))
    assert_true(close_to(coefficient_of_variation(v), 0.121499, atol=1e-5, rtol=0.0))

    # A relative spread is only meaningful away from a zero mean.
    with assert_raises(Error):
        var _ = coefficient_of_variation([-5.0, 0.0, 5.0])


def test_skewness_finds_the_hidden_population() raises:
    # A flat bulk with a few extreme values: the median is unremarkable and
    # the mean is dragged upward. This is the shape behind almost every
    # latency complaint, and the reason a median response time hides a
    # population of requests that take seconds.
    var latencies = [100.0, 105.0, 98.0, 102.0, 101.0, 99.0, 104.0, 900.0]
    assert_true(skewness(latencies) > 1.0)
    assert_true(level_median(latencies) < 105.0)

    with assert_raises(Error):
        var _ = skewness([1.0, 2.0])


def test_trend_reports_its_own_quality() raises:
    # A perfectly linear series: slope 5, intercept 2, r2 exactly 1. The r2
    # is the point of the report. A steep slope fitted to noise looks
    # identical from the slope alone, and announcing it as a trend is the
    # most common way to discover a trend that is not there.
    var line = [2.0, 7.0, 12.0, 17.0, 22.0, 27.0, 32.0, 37.0, 42.0, 47.0]
    var t = trend(line)
    assert_true(close_to(t.slope, 5.0, atol=1e-9, rtol=0.0))
    assert_true(close_to(t.intercept, 2.0, atol=1e-9, rtol=0.0))
    assert_true(close_to(t.r_squared, 1.0, atol=1e-12, rtol=0.0))
    assert_true(t.observations == 10)
    assert_true(t.is_meaningful)

    # A flat series has a slope of exactly zero, not a small positive one.
    var flat = trend([5.0] * 10)
    assert_true(close_to(flat.slope, 0.0, atol=1e-12, rtol=0.0))

    with assert_raises(Error):
        var _ = trend([1.0, 2.0])


def test_growth_rate_compounds() raises:
    # Doubling over four periods is 2^(1/4) - 1 = 18.92% a period, not the
    # 25% a linear division gives.
    var g = growth_rate(100.0, 200.0, 4.0)
    assert_true(close_to(g, 0.189207, atol=1e-5, rtol=0.0))
    assert_true(g < 0.25)

    # And it round-trips.
    assert_true(close_to(growth_rate(100.0, 100.0 * (1.0 + g) ** 4, 4.0), g,
                         atol=1e-9, rtol=0.0))

    with assert_raises(Error):
        var _ = growth_rate(0.0, 100.0, 1.0)
    with assert_raises(Error):
        var _ = growth_rate(100.0, 200.0, 0.0)


def test_index_to_base_makes_two_series_comparable() raises:
    # Two quantities in different units cannot share an axis. Rebasing to 100
    # at the first observation is what makes a chart of both readable, and
    # what stops a chart showing a trend that is purely a units artefact.
    var a = index_to_base([50.0, 55.0, 60.0])
    assert_true(close_to(a[0], 100.0))
    assert_true(close_to(a[2], 120.0))

    var b = index_to_base([2.0, 3.0, 3.0], 1.0)
    assert_true(close_to(b[0], 1.0))
    assert_true(close_to(b[2], 1.5))

    # Missing positions stay missing rather than becoming the base value.
    var with_gap = index_to_base([50.0, GAP, 60.0])
    assert_true(isnan(with_gap[1]))

    with assert_raises(Error):
        var _ = index_to_base([GAP, GAP])


def test_forecast_errors_disagree_and_that_is_the_point() raises:
    # Actual 10, 20, 30 against predicted 12, 18, 33. Errors -2, +2, -3.
    var actual = [10.0, 20.0, 30.0]
    var predicted = [12.0, 18.0, 33.0]
    var e = errors(actual, predicted)

    # MAE averages the magnitudes: 7/3.
    assert_true(close_to(e.mae, 7.0 / 3.0, atol=1e-12, rtol=0.0))
    # RMSE squares first: sqrt(17/3), which is strictly larger because the
    # -3 counts for more than the two +2s.
    assert_true(close_to(e.rmse, (17.0 / 3.0) ** 0.5, atol=1e-12, rtol=0.0))
    assert_true(e.rmse > e.mae)
    # MAPE is relative, so it weights the small actual more heavily.
    assert_true(close_to(e.mape, (0.2 + 0.1 + 0.1) / 3.0, atol=1e-12, rtol=0.0))
    # Bias is signed and here sums to -3, so the model over-predicts on
    # average. A bias of zero with a large RMSE is a different diagnosis
    # entirely, and the two are reported side by side for that reason.
    assert_true(close_to(e.bias, -1.0, atol=1e-12, rtol=0.0))
    assert_true(e.bias < 0.0)


def test_errors_refuse_what_it_cannot_measure() raises:
    var actual = [10.0, 20.0]
    # A length mismatch is the most common caller mistake and must not be
    # silently truncated.
    with assert_raises(Error):
        var _ = errors(actual, [12.0])
    # MAPE divides by the actual, so a zero there is unbounded.
    with assert_raises(Error):
        var _ = errors([0.0, 20.0], [1.0, 19.0])
    # A missing prediction has no error to measure.
    with assert_raises(Error):
        var _ = errors(actual, [12.0, GAP])
    with assert_raises(Error):
        var _ = errors([], [])


def test_report_structs_are_public_and_constructible() raises:
    # The reports are values, not opaque handles: a caller can build one,
    # read one, and pass one to their own code. That matters because the
    # report *is* the deliverable of a cleaning step -- there is no other
    # return channel for the information.
    var c = CleaningReport(3, 0, 0, [1, 4, 7])
    assert_true(c.removed == 3)
    assert_true(c.touched == 3)
    assert_true(not c.is_noop)

    var r = ErrorReport(1.0, 2.0, 0.5, -0.25)
    assert_true(r.mae == 1.0)
    assert_true(r.rmse > r.mae)
    assert_true(r.bias < 0.0)

    var trend_report = TrendReport(0.0, 5.0, 0.0, 10)
    assert_true(trend_report.is_meaningful)

    # The resample report's whole purpose is the count on it.
    var source = Series([0.0, 1.0, 2.0, 3.0], [10.0, 20.0, 30.0, 40.0])
    var resampled = resample(source, 1.0, 0.0, 3.0)
    assert_true(resampled.filled_points == 0)
    assert_true(resampled.is_clean)
    var grid = ResampleReport(source, 4, 0)
    assert_true(not grid.is_clean)

    var empty = CleaningReport(0, 0, 0, [])
    assert_true(empty.is_noop)


def test_median_matches_the_package_convention() raises:
    # `median_of` is exported so a caller gets exactly the number this
    # package reports, rather than reaching for a builtin median with a
    # different convention for an even-sized sample.
    var odd = [3.0, 1.0, 2.0]
    assert_true(close_to(median_of(odd), 2.0))
    # For an even count the two central values are averaged.
    var even = [1.0, 2.0, 3.0, 4.0]
    assert_true(close_to(median_of(even), 2.5))
    # And it agrees with the metric layer, which is the point of sharing one.
    assert_true(close_to(median_of(even), level_median(even)))


def main() raises:
    test_series_requires_ordered_time()
    test_series_rejects_non_finite_observations()
    test_gaps_are_visible()
    test_index_range_is_half_open()
    test_resample_reports_what_it_invented()
    test_resample_drops_what_it_cannot_fill()
    test_moving_average_is_shorter_by_exactly_a_window()
    test_moving_average_matches_a_direct_mean()
    test_differences_and_percentage_change()
    test_zscore_standardises_and_refuses_constants()

    test_missing_is_not_zero()
    test_drop_and_impute_are_the_two_halves_of_a_choice()
    test_impute_leading_gaps_are_carried_forward_not_invented()
    test_cleaning_reports_rather_than_acts()
    test_robust_outlier_rule_beats_the_naive_one()
    test_outlier_detection_needs_spread_to_measure_against()
    test_winsorize_keeps_the_row_and_a_real_value()
    test_dedupe_and_normalise()

    test_levels_and_the_choice_between_them()
    test_percentiles_agree_with_each_other()
    test_spread_measures()
    test_skewness_finds_the_hidden_population()
    test_trend_reports_its_own_quality()
    test_growth_rate_compounds()
    test_index_to_base_makes_two_series_comparable()
    test_forecast_errors_disagree_and_that_is_the_point()
    test_errors_refuse_what_it_cannot_measure()
    test_report_structs_are_public_and_constructible()
    test_median_matches_the_package_convention()

    print("mdat: all 28 tests passed")