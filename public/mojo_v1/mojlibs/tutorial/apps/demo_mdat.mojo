# demo_mdat.mojo — a deterministic tour of the data analytics package.
#
# Built around one dataset with deliberate problems: two missing readings, a
# flat-lined stretch from a sensor that stopped reporting, and one request
# that took nine times as long as any other. Every number printed is
# arithmetic that `src/verify_numbers.py` re-derives independently.
#
# Run with:  mojo run apps/demo_mdat.mojo

from std.testing import assert_true
from std.utils.numerics import isnan

from mojo_core import close_to

from mdat import Series
from mdat import coverage
from mdat import drop_missing
from mdat import errors
from mdat import find_outliers
from mdat import gap_report
from mdat import growth_rate
from mdat import index_to_base
from mdat import is_regular
from mdat import level_mean
from mdat import level_median
from mdat import max_gap
from mdat import percentiles
from mdat import resample
from mdat import skewness
from mdat import trend


def latency_series() raises -> Series:
    # Response times in milliseconds, sampled once a minute. Three minutes
    # have no reading at all (indices 3 and 7 are missing) and one request
    # took 900 ms when the rest cluster around 100.
    return Series(
        [0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0],
        [
            100.0,
            FloatLiteral.nan,
            98.0,
            101.0,
            104.0,
            99.0,
            102.0,
            FloatLiteral.nan,
            103.0,
            900.0,
        ],
    )


def show_coverage() raises:
    print("== what is actually there ==")
    var s = latency_series()
    print("  observations ", s.count())
    print("  coverage     ", coverage(s.values))
    print("  gaps in time ", gap_report(s))

    # 8 of 10 readings present. A mean over 80% of a series is a mean of
    # whichever part happened to be recorded, and which part that is usually
    # not random.
    assert_true(close_to(coverage(s.values), 0.8))
    assert_true(len(gap_report(s)) == 9)
    print("  -> an average over 80% of the series is not an average of it")
    print()


def show_missing_is_not_zero() raises:
    print("== missing is not zero ==")
    var s = latency_series()
    var with_gaps = s.values

    # What the package reports.
    print("  mean of what was observed ", level_mean(with_gaps))

    # What it reports if the gaps are quietly filled with zero, which is the
    # single most consequential mistake in applied analytics.
    var as_zero = List[Float64]()
    for i in range(len(with_gaps)):
        if isnan(with_gaps[i]):
            as_zero.append(0.0)
        else:
            as_zero.append(with_gaps[i])
    print("  mean if gaps are zero     ", level_mean(as_zero))

    # 1607 spread over the eight observations that exist gives 200.875. Spread
    # the same total over all ten slots, two of which hold a fabricated zero,
    # gives 160.7. Nothing about the data changed; only the handling of the
    # gaps, and the average moved by 40 ms -- which is twice the spread of the
    # ordinary requests in the same window.
    assert_true(level_mean(as_zero) < level_mean(with_gaps))
    print("  -> the same data, a mean that is wrong by 40 ms")
    print()


def show_the_flat_line() raises:
    print("== a sensor that stopped reporting ==")
    # Six readings at 5-second spacing, but one interval of 50: a gap in
    # observation that a rolling average renders invisible.
    var s = Series([0.0, 5.0, 10.0, 15.0, 20.0, 70.0], [1.0, 1.0, 1.0, 1.0, 1.0, 1.0])
    var gaps = gap_report(s)
    print("  intervals   ", gaps)
    print("  max gap     ", max_gap(s))
    print("  regular     ", is_regular(s))

    # Resampled onto a 10-second grid, most of it has to be invented.
    var r = resample(s, 10.0, 0.0, 80.0)
    print("  resampled   ", r.series.count(), "points")
    print("  invented    ", r.filled_points)
    print("  clean       ", r.is_clean)

    # Exactly half the grid has no observation behind it. Half is already
    # enough to make the series useless without a warning, and every value
    # on that half is the last known value rather than a measurement.
    assert_true(close_to(max_gap(s), 50.0))
    assert_true(not r.is_clean)
    assert_true(r.filled_points * 2 == r.series.count())
    print("  -> the count on the report is what stops this being used blindly")
    print()


def show_the_hidden_population() raises:
    print("== one request, ninety times too slow ==")
    var s = latency_series()
    var observed = drop_missing(s.values)

    print("  median      ", level_median(observed))
    print("  mean        ", level_mean(observed))
    print("  skewness    ", skewness(observed))
    print("  p25/p50/p75 ", percentiles(observed))

    # The median is unremarkable. The mean is not, and the gap between them
    # is a small number of catastrophic requests that the median cannot see.
    # This shape is behind essentially every latency complaint.
    assert_true(level_median(observed) < level_mean(observed))
    assert_true(skewness(observed) > 1.0)
    print("  -> the median says nothing about the 900 ms request")
    print()


def show_robust_outliers() raises:
    print("== why the outlier rule uses the median ==")
    # Nine values between 10 and 14, and one of 1000.
    var v = [10.0, 12.0, 11.0, 13.0, 12.0, 11.0, 14.0, 13.0, 12.0, 1000.0]
    var found = find_outliers(v, 3.0)
    print("  flagged     ", found)

    # The mean-based arithmetic, spelled out. The mean is dragged to 110.8
    # and the standard deviation inflated to 312.4, so three sigmas is 937 --
    # and the 1000 sits inside it. The most extreme value in the dataset is
    # invisible to the test that exists to find it, because the value has
    # already corrupted the statistic being tested.
    var m = 0.0
    for i in range(len(v)):
        m += v[i]
    m = m / 10.0
    var acc = 0.0
    for i in range(len(v)):
        var d = v[i] - m
        acc += d * d
    var sd = (acc / 9.0) ** 0.5
    print("  naive mean  ", m)
    print("  naive sd    ", sd)
    print("  3 x sd      ", 3.0 * sd)
    print("  outlier dev ", abs(1000.0 - m))
    print("  naive flags ", abs(1000.0 - m) > 3.0 * sd)

    assert_true(len(found) == 1)
    assert_true(found[0] == 9)
    assert_true(abs(1000.0 - m) < 3.0 * sd)
    print("  -> robust finds it, mean-based cannot")
    print()


def show_a_trend_with_its_quality() raises:
    print("== a trend, and how much to believe it ==")
    # A clean rising series and a noisy one with the same average slope.
    var clean = [2.0, 7.0, 12.0, 17.0, 22.0, 27.0, 32.0, 37.0, 42.0, 47.0]
    var noisy = [50.0, 10.0, 55.0, 15.0, 45.0, 20.0, 40.0, 25.0, 35.0, 30.0]

    var a = trend(clean)
    var b = trend(noisy)
    print("  clean  slope ", a.slope, " r2 ", a.r_squared)
    print("  noisy  slope ", b.slope, " r2 ", b.r_squared)
    print("  noisy meaningful ", b.is_meaningful)

    # The slope is the number that gets quoted, and on its own it cannot be
    # distinguished from a line fitted through noise. The r2 is what tells
    # the two apart, which is why it is on the report rather than being
    # something the caller has to remember to compute.
    assert_true(close_to(a.slope, 5.0, atol=1e-9, rtol=0.0))
    assert_true(not b.is_meaningful)
    print("  -> quoting a slope without its r2 is quoting half an answer")
    print()


def show_forecast_error() raises:
    print("== four error measures, four different verdicts ==")
    var actual = [10.0, 20.0, 30.0]
    var predicted = [12.0, 18.0, 33.0]
    var e = errors(actual, predicted)
    print("  MAE   ", e.mae)
    print("  RMSE  ", e.rmse)
    print("  MAPE  ", e.mape)
    print("  bias  ", e.bias)

    # MAE and RMSE disagree because the -3 counts for more than the two +2s.
    # Bias is negative, so the model over-predicts on average -- a constant
    # offset would fix it. Reporting only RMSE would have hidden that.
    assert_true(e.rmse > e.mae)
    assert_true(e.bias < 0.0)
    print("  -> the bias is the only one that says which way to fix it")
    print()


def show_comparison() raises:
    print("== putting two series on one axis ==")
    # Two request queues measured in different units. Raw levels cannot share
    # an axis; rebasing to 100 makes the comparison meaningful and prevents a
    # chart from showing a trend that is purely a units artefact.
    var queue_a = [50.0, 52.0, 48.0, 55.0, 60.0]
    var queue_b = [200.0, 210.0, 190.0, 220.0, 260.0]
    var ra = index_to_base(queue_a)
    var rb = index_to_base(queue_b)
    print("  A rebased ", ra)
    print("  B rebased ", rb)

    assert_true(close_to(ra[0], 100.0))
    assert_true(close_to(rb[0], 100.0))

    # And the growth rate is geometric, because compounding is the only thing
    # that adds up over time.
    print("  A growth  ", growth_rate(50.0, 60.0, 4.0))
    print("  B growth  ", growth_rate(200.0, 260.0, 4.0))
    print()


def main() raises:
    show_coverage()
    show_missing_is_not_zero()
    show_the_flat_line()
    show_the_hidden_population()
    show_robust_outliers()
    show_a_trend_with_its_quality()
    show_forecast_error()
    show_comparison()
    print("mdat demo complete")