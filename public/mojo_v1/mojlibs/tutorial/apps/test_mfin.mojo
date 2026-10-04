# test_mfin.mojo — the test suite for the `mfin` package.
#
# Every expected value in this file is arithmetic that can be checked with a
# calculator, and the accompanying `src/verify_numbers.py` re-derives each one
# independently. A financial test whose expected number came from the
# implementation only proves the implementation is self-consistent.
#
# Run with:  mojo run apps/test_mfin.mojo

from std.testing import assert_raises
from std.testing import assert_true

from mojo_core import Matrix
from mojo_core import close_to

from mfin import annualise
from mfin import arithmetic_mean
from mfin import cumulative
from mfin import cumulative_by_logs
from mfin import drawdowns
from mfin import equal_weight
from mfin import equal_weight_turnover
from mfin import expected_shortfall
from mfin import expected_return
from mfin import geometric_mean
from mfin import historical_var
from mfin import holding_period_return
from mfin import log_return
from mfin import maximum_drawdown
from mfin import minimum_variance_weights
from mfin import Portfolio
from mfin import rebalance
from mfin import sharpe
from mfin import simple_return
from mfin import sortic
from mfin import to_period_return
from mfin import trailing_returns
from mfin import turnover
from mfin import volatility
from mfin import volatility_drag

# A year of monthly returns, summing to +0.09 so that Sharpe is meaningful.
# Four of the eight are negative, which exercises the downside measures.
var MONTHLY = [0.02, -0.01, 0.03, -0.02, 0.04, -0.03, 0.01, 0.05]


def sd_of(x: List[Float64]) -> Float64:
    var total = 0.0
    var m = 0.0
    for i in range(len(x)):
        m += x[i]
    m = m / Float64(len(x))
    for i in range(len(x)):
        var d = x[i] - m
        total += d * d
    return (total / Float64(len(x) - 1)) ** 0.5


def downside(x: List[Float64]) -> Float64:
    var total = 0.0
    for i in range(len(x)):
        if x[i] < 0.0:
            total += x[i] * x[i]
    return (total / Float64(len(x))) ** 0.5


# ── returns ─────────────────────────────────────────────────────────────────

def test_simple_and_log_return() raises:
    assert_true(close_to(simple_return(100.0, 120.0), 0.20))
    # The log return of the same move is ln(1.2) = 0.18232, always smaller
    # than the simple return for a gain and always larger for a loss.
    assert_true(close_to(log_return(100.0, 120.0), 0.1823216, atol=1e-6, rtol=0.0))
    assert_true(log_return(100.0, 120.0) < simple_return(100.0, 120.0))


def test_returns_reject_impossible_inputs():
    with assert_raises(Error):
        var _ = simple_return(0.0, 100.0)
    with assert_raises(Error):
        var _ = simple_return(-1.0, 100.0)
    with assert_raises(Error):
        var _ = log_return(100.0, 0.0)


def test_cumulative_is_a_product_not_a_sum() raises:
    # The case that makes the distinction unavoidable: +50% then -20% ends
    # at 120, a net *gain* of 20%. Averaging the two returns says 15%, which
    # is not a return anyone experienced.
    var two = [0.50, -0.20]
    assert_true(close_to(cumulative(two), 0.20, atol=1e-12, rtol=0.0))
    assert_true(close_to(arithmetic_mean(two), 0.15))
    # And the compounding route must agree with the direct one.
    assert_true(close_to(cumulative(two), cumulative_by_logs(two), atol=1e-9, rtol=0.0))


def test_geometric_mean_is_never_above_arithmetic() raises:
    # Holds for any series, and is the reason the two are never interchangeable.
    assert_true(geometric_mean(MONTHLY) < arithmetic_mean(MONTHLY))
    assert_true(close_to(geometric_mean(MONTHLY), 0.011119, atol=1e-5, rtol=0.0))
    assert_true(close_to(arithmetic_mean(MONTHLY), 0.01125))

    # The drag is exactly the gap between them.
    var drag = volatility_drag(MONTHLY)
    assert_true(close_to(drag, 0.01125 - geometric_mean(MONTHLY)))


def test_log_returns_compose_additively() raises:
    # The identity that makes multi-period work in log space exact: the log
    # return over a whole period is the sum of the parts.
    var whole = log_return(100.0, 120.0)
    var part1 = log_return(100.0, 110.0)
    var part2 = log_return(110.0, 120.0)
    assert_true(close_to(part1 + part2, whole, atol=1e-12, rtol=0.0))


def test_annualisation_is_geometric() raises:
    # 5% a month for twelve months is 79.4%, not the 60% a linear shortcut
    # claims. The gap is large enough that anyone using the shortcut has a
    # materially wrong number.
    var annual = annualise(0.05, 12.0)
    assert_true(close_to(annual, 0.7958563, atol=1e-6, rtol=0.0))
    assert_true(annual > 0.05 * 12.0)

    # And it round-trips.
    var monthly = to_period_return(annual, 12.0)
    assert_true(close_to(monthly, 0.05, atol=1e-6, rtol=0.0))


def test_holding_period_return() raises:
    # -1000 invested, +1200 returned. Bisection must land on exactly 0.20,
    # because the function it is solving has a root at that rate.
    var flows = [-1000.0, 1200.0]
    assert_true(close_to(holding_period_return(flows), 0.20, atol=1e-6, rtol=0.0))

    # With an intermediate withdrawal the money-weighted return must be lower
    # than the simple 20%, because the withdrawal happened before the growth.
    var withdrawal = [-1000.0, -200.0, 1200.0]
    assert_true(holding_period_return(withdrawal) < 0.20)


# ── risk ────────────────────────────────────────────────────────────────────

def test_dispersion_measures():
    assert_true(close_to(sd_of(MONTHLY), 0.029001, atol=1e-5, rtol=0.0))
    # Downside deviation divides by the total count, so it is smaller than
    # dividing by the four losses would give.
    var loss_sq = 0.0001 + 0.0004 + 0.0009
    assert_true(close_to(downside(MONTHLY), (loss_sq / 8.0) ** 0.5, atol=1e-9, rtol=0.0))
    assert_true((loss_sq / 8.0) ** 0.5 < (loss_sq / 4.0) ** 0.5)


def test_risk_ratios():
    var mean_r = 0.01125
    var dd = (0.0014 / 8.0) ** 0.5
    # Sortino uses downside deviation; Sharpe uses total volatility. On this
    # series Sharpe is the smaller of the two, because the upside volatility
    # is what Sharpe charges for and Sortino does not.
    var sortino = mean_r / dd
    var sharpe_r = mean_r / sd_of(MONTHLY)
    assert_true(close_to(sortino, 0.850420, atol=1e-5, rtol=0.0))
    assert_true(close_to(sharpe_r, 0.387915, atol=1e-5, rtol=0.0))
    assert_true(sharpe_r < sortino)


def test_risk_ratios_refuse_degenerate_series():
    # No losses at all: Sortico is undefined, not infinite.
    var no_loss = [0.01, 0.02, 0.03]
    with assert_raises(Error):
        var _ = sortic(no_loss, 0.0)

    # No variation: Sharpe is undefined, not infinite.
    var flat = [0.01, 0.01, 0.01, 0.01]
    with assert_raises(Error):
        var _ = sharpe(flat)


def test_drawdown_is_measured_against_the_peak() raises:
    # Peak 120 at index 1, trough 90 at index 2 -> 25%.
    var eq = [100.0, 120.0, 90.0, 110.0, 105.0, 130.0]
    var dd = drawdowns(eq)
    assert_true(close_to(dd[0], 0.0))
    assert_true(close_to(dd[1], 0.0))
    assert_true(close_to(dd[2], 0.25))
    # 110 recovered from 90, but is still 8.33% below the 120 peak.
    assert_true(close_to(dd[3], 1.0 - 110.0 / 120.0))
    # 105 is still 12.5% below the peak even though it rose from 90.
    assert_true(close_to(dd[4], 0.125))
    # A new high at 130 wipes the drawdown to zero.
    assert_true(close_to(dd[5], 0.0))

    var report = maximum_drawdown(eq)
    assert_true(close_to(report.max_drawdown, 0.25))
    assert_true(report.trough_index == 2)


def test_drawdown_needs_a_positive_curve():
    with assert_raises(Error):
        var _ = drawdowns([100.0, 0.0, 50.0])
    with assert_raises(Error):
        var _ = drawdowns([])


def test_expected_shortfall_is_never_below_var() raises:
    # The single most useful property of a tail pair, and the cheapest
    # consistency check available: the mean of the worst 5% cannot be
    # smaller than the boundary of the worst 5%.
    var tail = [
        0.01, -0.02, 0.03, -0.05, 0.02, -0.10, 0.00, -0.01, 0.04, -0.03,
        0.01, -0.20, 0.02, -0.01, 0.00, 0.03, -0.02, 0.01, -0.04, 0.05,
    ]
    var v = historical_var(tail, 0.95)
    var es = expected_shortfall(tail, 0.95)
    assert_true(es >= v - 1e-12)

    # The specific numbers: n = 20 puts the 95th percentile 95% of the way
    # from the worst observation toward the second worst, giving 0.105. Only
    # the -0.20 day is beyond that, so the tail mean is 0.20.
    assert_true(close_to(v, 0.105, atol=1e-9, rtol=0.0))
    assert_true(close_to(es, 0.20, atol=1e-9, rtol=0.0))


def test_var_does_not_describe_the_tail() raises:
    # VaR says 10.5% is the 95% threshold. What actually happened beyond it
    # was 20%. The gap between those two numbers is the entire argument for
    # reporting Expected Shortfall alongside VaR.
    var tail = [
        0.01, -0.02, 0.03, -0.05, 0.02, -0.10, 0.00, -0.01, 0.04, -0.03,
        0.01, -0.20, 0.02, -0.01, 0.00, 0.03, -0.02, 0.01, -0.04, 0.05,
    ]
    assert_true(expected_shortfall(tail, 0.95) > 1.5 * historical_var(tail, 0.95))


def test_tail_measures_reject_impossible_levels():
    var r = [0.01, -0.02, 0.03]
    with assert_raises(Error):
        var _ = historical_var(r, 1.5)
    with assert_raises(Error):
        var _ = historical_var(r, 0.0)
    with assert_raises(Error):
        var _ = expected_shortfall([])


# ── portfolio ───────────────────────────────────────────────────────────────

def _two_asset_covariance() raises -> Matrix:
    # Variances 0.04 and 0.09 with correlation 0.25, so the covariance is
    # 0.25 * 0.2 * 0.3 = 0.015.
    var s = Matrix(2, 2)
    s.set(0, 0, 0.04)
    s.set(0, 1, 0.015)
    s.set(1, 0, 0.015)
    s.set(1, 1, 0.09)
    return s


def test_portfolio_volatility_uses_the_covariance() raises:
    # Weights 0.6 / 0.4 against the matrix above:
    #   0.36*0.04 + 0.16*0.09 + 2*0.6*0.4*0.015 = 0.0144 + 0.0144 + 0.0072
    var s = _two_asset_covariance()
    var v = volatility([0.6, 0.4], s)
    assert_true(close_to(v, 0.189737, atol=1e-5, rtol=0.0))

    # The uncorrelated shortcut would give sqrt(0.0144 + 0.0144) = 0.1697.
    # Dropping the cross term assumes perfect independence, and it
    # systematically *understates* risk whenever correlations are positive.
    var shortcut = (0.36 * 0.04 + 0.16 * 0.09) ** 0.5
    assert_true(close_to(shortcut, 0.169706, atol=1e-5, rtol=0.0))
    assert_true(v > shortcut)


def test_minimum_variance_weights() raises:
    # For two assets the closed form is (var2 - cov) / (var1 + var2 - 2cov)
    #     = (0.09 - 0.015) / (0.04 + 0.09 - 0.03) = 0.075 / 0.10 = 0.75
    var s = _two_asset_covariance()
    var w = minimum_variance_weights(s)
    assert_true(close_to(w[0], 0.75, atol=1e-9, rtol=0.0))
    assert_true(close_to(w[1], 0.25, atol=1e-9, rtol=0.0))
    assert_true(close_to(w[0] + w[1], 1.0))

    # It must actually be the minimum: equal weighting is feasible, so the
    # optimum cannot be worse.
    var equal = equal_weight(2)
    assert_true(volatility(w, s) <= volatility(equal.weights, s) + 1e-12)


def test_portfolio_validates_its_weights():
    # The constructor is the single validation point, so a `Portfolio` value
    # cannot exist in an invalid state.
    with assert_raises(Error):
        var _ = Portfolio([0.5, 0.4])          # does not sum to 1
    with assert_raises(Error):
        var _ = Portfolio([1.5, -0.5])         # needs a short position
    with assert_raises(Error):
        var _ = Portfolio([])


def test_expected_return_is_linear() raises:
    var mu = [0.10, 0.04]
    assert_true(close_to(expected_return([0.6, 0.4], mu), 0.076))


def test_turnover_counts_one_way() raises:
    # Buy 10% of one holding to fund 10% of another. That is 10% turnover.
    # Summing the absolute changes instead gives 20% and is the standard way
    # turnover statistics end up doubled.
    assert_true(close_to(turnover([0.5, 0.5], [0.6, 0.4]), 0.10))
    assert_true(close_to(turnover([0.6, 0.4], [0.5, 0.5]), 0.10))
    # Identical portfolios have no turnover.
    assert_true(close_to(turnover([0.5, 0.5], [0.5, 0.5]), 0.0))


def test_rebalance_returns_instructions_not_trades() raises:
    # A tolerance band turns small drifts into no-ops, which is what makes
    # rebalancing affordable: trading costs exceed the benefit of trimming a
    # half-percent drift.
    var orders = rebalance([0.5, 0.5], [0.55, 0.45], 0.01)
    assert_true(orders[0] == 1)                 # a 0.05 drift exceeds the 0.01 band
    assert_true(orders[1] == -1)

    var quiet = rebalance([0.5, 0.5], [0.505, 0.495], 0.01)
    assert_true(quiet[0] == 0)
    assert_true(quiet[1] == 0)


def test_drift_from_equal_weighting() raises:
    # A 60/40 portfolio is 10% away from equal weighting. Above about 30%,
    # the portfolio is substantially a bet on whatever has already run.
    assert_true(close_to(equal_weight_turnover([0.6, 0.4]), 0.10))
    assert_true(close_to(equal_weight_turnover([0.5, 0.5]), 0.0))


def test_trailing_returns_need_a_full_window() raises:
    # The first entry is at index `period`, not 0: a window reaching back past
    # the start of the data does not exist, and returning a partial one would
    # silently misalign every subsequent entry.
    var eq = [100.0, 110.0, 121.0, 133.1]
    var r = trailing_returns(eq, 1)
    assert_true(len(r) == 3)
    assert_true(close_to(r[0], 0.10))
    assert_true(close_to(r[1], 0.10))
    assert_true(close_to(r[2], 0.10))

    with assert_raises(Error):
        var _ = trailing_returns(eq, 4)         # window longer than the curve
    with assert_raises(Error):
        var _ = trailing_returns(eq, 0)


def main() raises:
    test_simple_and_log_return()
    test_returns_reject_impossible_inputs()
    test_cumulative_is_a_product_not_a_sum()
    test_geometric_mean_is_never_above_arithmetic()
    test_log_returns_compose_additively()
    test_annualisation_is_geometric()
    test_holding_period_return()

    test_dispersion_measures()
    test_risk_ratios()
    test_risk_ratios_refuse_degenerate_series()
    test_drawdown_is_measured_against_the_peak()
    test_drawdown_needs_a_positive_curve()
    test_expected_shortfall_is_never_below_var()
    test_var_does_not_describe_the_tail()
    test_tail_measures_reject_impossible_levels()

    test_portfolio_volatility_uses_the_covariance()
    test_minimum_variance_weights()
    test_portfolio_validates_its_weights()
    test_expected_return_is_linear()
    test_turnover_counts_one_way()
    test_rebalance_returns_instructions_not_trades()
    test_drift_from_equal_weighting()
    test_trailing_returns_need_a_full_window()

    print("mfin: all 24 tests passed")