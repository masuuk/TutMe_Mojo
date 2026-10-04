# demo_mfin.mojo — a deterministic tour of the finance package.
#
# The numbers printed below are arithmetic you can verify by hand, and the
# accompanying `src/verify_numbers.py` re-derives every one of them. Nothing
# is captured from a session, so nothing can drift away from the code.
#
# Run with:  mojo run apps/demo_mfin.mojo

from std.testing import assert_true

from mojo_core import Matrix
from mojo_core import close_to

from mfin import annualise
from mfin import arithmetic_mean
from mfin import cumulative
from mfin import drawdowns
from mfin import equal_weight_turnover
from mfin import expected_shortfall
from mfin import geometric_mean
from mfin import historical_var
from mfin import maximum_drawdown
from mfin import minimum_variance_weights
from mfin import sharpe
from mfin import sortic
from mfin import turnover
from mfin import volatility
from mfin import volatility_drag


def show_compounding() raises:
    print("== compounding: the whole ballgame ==")
    # +50% then -20%. The money ends at 120, a net gain of 20%.
    print("  returns      ", [0.50, -0.20])
    print("  cumulative   ", cumulative([0.50, -0.20]))
    print("  arithmetic   ", arithmetic_mean([0.50, -0.20]))
    print("  geometric    ", geometric_mean([0.50, -0.20]))
    print("  drag         ", volatility_drag([0.50, -0.20]))
    # The arithmetic mean says 15%. Nobody experienced 15%: they made 50%
    # and then lost 20% of a larger amount. This one example is why the two
    # means are separate functions in this library.
    assert_true(close_to(cumulative([0.50, -0.20]), 0.20))
    assert_true(close_to(arithmetic_mean([0.50, -0.20]), 0.15))
    print()


def show_annualisation() raises:
    print("== annualising a periodic return ==")
    print("  5% per month, linear shortcut ", 0.05 * 12)
    print("  5% per month, compounded      ", annualise(0.05, 12.0))
    # A 19 percentage point difference, and the shortcut is the one people
    # use because it is easier. Over a long horizon the error compounds too.
    assert_true(annualise(0.05, 12.0) > 0.79)
    print("  -> the shortcut understates a good year by 19 points")
    print()


def show_a_return_series() raises:
    print("== a year of monthly returns ==")
    var r = [0.02, -0.01, 0.03, -0.02, 0.04, -0.03, 0.01, 0.05]
    print("  returns     ", r)
    print("  total       ", cumulative(r))
    print("  arithmetic  ", arithmetic_mean(r))
    print("  geometric   ", geometric_mean(r))
    print("  sharpe      ", sharpe(r))
    print("  sortino     ", sortic(r))
    # Sharpe is lower because it charges for upside volatility as well as
    # downside. Whether that is right is a modelling choice; that it is a
    # choice is not.
    assert_true(sharpe(r) < sortic(r))
    print()


def show_drawdown() raises:
    print("== drawdown ==")
    var equity = [100.0, 120.0, 90.0, 110.0, 105.0, 130.0]
    print("  equity    ", equity)
    var dd = drawdowns(equity)
    print("  drawdown  ", dd)
    var report = maximum_drawdown(equity)
    print("  max dd    ", report.max_drawdown)
    print("  at index  ", report.trough_index)
    print("  underwater", report.longest_underwater_runs)
    # Index 4 is the interesting one: 105 rose from 90, and is still 12.5%
    # below the peak. Drawdown is measured against the peak, never against
    # the last local low.
    assert_true(close_to(dd[4], 0.125))
    assert_true(close_to(report.max_drawdown, 0.25))
    print()


def show_tail_risk() raises:
    print("== tail risk ==")
    var r = [
        0.01, -0.02, 0.03, -0.05, 0.02, -0.10, 0.00, -0.01, 0.04, -0.03,
        0.01, -0.20, 0.02, -0.01, 0.00, 0.03, -0.02, 0.01, -0.04, 0.05,
    ]
    var v = historical_var(r, 0.95)
    var es = expected_shortfall(r, 0.95)
    print("  observations ", len(r))
    print("  VaR 95%      ", v)
    print("  ES 95%       ", es)
    print("  worst day    ", -0.20)
    # VaR says the threshold is 10.5%. The day beyond it lost 20%. Quoting
    # VaR alone would tell a reader the worst case was roughly half what it
    # actually was, and the 95% label makes that sound authoritative.
    assert_true(es >= v - 1e-12)
    assert_true(es > 1.5 * v)
    print("  -> ES is nearly twice the VaR: the tail is not normal")
    print()


def show_portfolio() raises:
    print("== portfolio construction ==")
    # Two assets, variances 0.04 and 0.09, correlation 0.25.
    var s = Matrix(2, 2)
    s.set(0, 0, 0.04)
    s.set(0, 1, 0.015)
    s.set(1, 0, 0.015)
    s.set(1, 1, 0.09)

    print("  volatilities  0.200  0.300")
    print("  correlation   0.25")

    var eq = volatility([0.5, 0.5], s)
    var mv = volatility(minimum_variance_weights(s), s)
    print("  equal weight vol  ", eq)
    print("  min variance vol  ", mv)
    print("  min variance w    ", minimum_variance_weights(s))

    # The closed form for two assets is (var2 - cov) / (var1 + var2 - 2cov),
    # which here is 0.075 / 0.10 = 0.75. The lower-variance asset gets the
    # larger weight, as it should.
    var w = minimum_variance_weights(s)
    assert_true(close_to(w[0], 0.75, atol=1e-9, rtol=0.0))
    assert_true(mv < eq)

    # And the shortcut that ignores correlation would understate both.
    var shortcut = (0.25 * 0.04 + 0.25 * 0.09) ** 0.5
    print("  shortcut (rho=0)   ", shortcut)
    assert_true(eq > shortcut)
    print("  -> ignoring correlation understates risk")
    print()


def show_rebalancing() raises:
    print("== rebalancing ==")
    var current = [0.60, 0.40]
    var target = [0.50, 0.50]
    print("  current   ", current)
    print("  target    ", target)
    print("  turnover  ", turnover(current, target))
    print("  drift     ", equal_weight_turnover(current))
    # 0.10 either way, not 0.20: the money leaves one holding and arrives at
    # another, and only one side is a purchase.
    assert_true(close_to(turnover(current, target), 0.10))
    assert_true(close_to(turnover(target, current), 0.10))
    print()


def main() raises:
    show_compounding()
    show_annualisation()
    show_a_return_series()
    show_drawdown()
    show_tail_risk()
    show_portfolio()
    show_rebalancing()
    print("mfin demo complete")