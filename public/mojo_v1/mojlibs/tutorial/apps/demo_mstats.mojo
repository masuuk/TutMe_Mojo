# demo_mstats.mojo — a deterministic tour of the statistics package.
#
# Every figure printed below is arithmetic you can check on paper. Nothing is
# captured from a session, so the numbers cannot drift away from the code.
#
# Run with:  mojo run apps/demo_mstats.mojo

from std.testing import assert_true

from mstats import critical_z
from mstats import confidence_interval
from mstats import least_squares
from mstats import median
from mstats import median_absolute_deviation
from mstats import normal_cdf
from mstats import pearson
from mstats import quantile
from mstats import spearman
from mstats import standard_deviation
from mstats import summarize
from mstats import two_sided_p
from mstats import variance

from mojo_core import close_to


def show_location_and_spread() raises:
    var x = [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]
    print("== location and spread ==")
    print("  data        ", x)
    var s = summarize(x)
    print("  n           ", s.n)
    print("  mean        ", s.mean_value)
    print("  median      ", s.median_value)
    print("  sd (sample) ", s.sd)
    print("  variance    ", variance(x, True))
    print("  IQR         ", s.iqr())
    print("  Q1, Q3      ", quantile(x, 0.25), " ", quantile(x, 0.75))
    print("  MAD         ", median_absolute_deviation(x))

    # The mean sits above the median because the 9 pulls it up. When those two
    # disagree by a lot, the distribution is skewed and the mean is the worse
    # summary of a typical observation.
    assert_true(close_to(s.mean_value, 5.0))
    assert_true(close_to(s.median_value, 4.5))
    assert_true(s.mean_value > s.median_value)
    print()


def show_the_normal() raises:
    print("== the normal distribution ==")
    # z for 97.5% of the mass, the number behind every 95% interval.
    print("  cdf(0)          ", normal_cdf(0.0))
    print("  cdf(1.96)       ", normal_cdf(1.959964))
    print("  cdf(2.58)       ", normal_cdf(2.575829))
    # Symmetry: the upper and lower tails at the 5% level are identical.
    print("  p(1.96) 2-sided ", two_sided_p(1.959964))
    # An observation 3 sd out is 0.27% likely under the null - roughly one in
    # 370. That is the usual threshold for "this is not noise".
    print("  p(3.00)         ", two_sided_p(3.0))
    print("  critical z 5%   ", critical_z(0.05, True))
    print("  critical z 1%   ", critical_z(0.01, True))
    print()


def show_confidence() raises:
    print("== confidence interval for a mean ==")
    # n grows, the interval narrows by sqrt(n): 8 -> 800 is a factor of 10
    # in width.
    for n in [8, 80, 800]:
        var bounds = confidence_interval(5.0, 2.0, n, 0.95)
        print("  n=", n, "  width=", bounds[1] - bounds[0])
    assert_true(confidence_interval(5.0, 2.0, 800, 0.95)[1] -
                confidence_interval(5.0, 2.0, 800, 0.95)[0] <
                confidence_interval(5.0, 2.0, 8, 0.95)[1] -
                confidence_interval(5.0, 2.0, 8, 0.95)[0])
    print()


def show_relationship() raises:
    print("== relationship ==")
    var hours = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]
    var errors = [7.1, 5.9, 6.2, 4.0, 3.8, 2.1, 2.4, 0.9]
    print("  hours   ", hours)
    print("  errors  ", errors)
    print("  pearson ", pearson(hours, errors))
    print("  spearman", spearman(hours, errors))

    var fit = least_squares(hours, errors)
    print("  fit: errors = ", fit.slope, " * hours + ", fit.intercept)
    print("  R^2     ", fit.r2)
    print("  resid sd", fit.residual_sd)
    # A slope of -0.874 errors per hour with a residual spread of 0.55: each
    # extra hour of uptime removes most of an error. The r2 of 0.947 is the
    # more important number, because it says how much of the variation in the
    # error count one predictor accounts for -- and therefore how much is
    # still unexplained.
    assert_true(close_to(fit.slope, -0.873810, atol=1e-5, rtol=0.0))
    assert_true(close_to(fit.intercept, 7.982143, atol=1e-5, rtol=0.0))
    assert_true(close_to(fit.r2, 0.947100, atol=1e-5, rtol=0.0))
    print()


def show_robustness() raises:
    print("== why the MAD exists ==")
    var clean = [10.0, 10.2, 9.9, 10.1, 10.0, 9.8, 10.3, 10.0]
    var dirty = [10.0, 10.2, 9.9, 10.1, 10.0, 9.8, 10.3, 10.0, 900.0]
    print("  sd  clean ", standard_deviation(clean, False))
    print("  sd  dirty ", standard_deviation(dirty, False))
    print("  mad clean ", median_absolute_deviation(clean))
    print("  mad dirty ", median_absolute_deviation(dirty))
    # The outlier moves the sd by more than an order of magnitude and the MAD
    # barely at all. Neither is wrong; they answer different questions.
    assert_true(standard_deviation(dirty, False) / standard_deviation(clean, False) > 10.0)
    print()


def main() raises:
    show_location_and_spread()
    show_the_normal()
    show_confidence()
    show_relationship()
    show_robustness()
    print("mstats demo complete")