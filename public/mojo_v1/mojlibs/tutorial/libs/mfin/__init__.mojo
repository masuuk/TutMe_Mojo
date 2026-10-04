# __init__.mojo — the public API of the `mfin` package.
#
# Two organising decisions run through this surface, both of them about not
# letting a plausible number stand in for a correct one:
#
#   1. **Arithmetic and geometric means are separate, named functions.**
#      Collapsing them into `average()` with a flag is how a backtest ends up
#      reporting a return nobody earned.
#   2. **Tail measures come in pairs.** `historical_var` and
#      `expected_shortfall` are documented as travelling together, and
#      `expected_shortfall` is provably never smaller than the VaR it
#      accompanies -- an inequality cheap enough to assert in every test.
#
# This package depends on `mstats` for means and quantile conventions, so
# the two cannot drift into disagreeing about which number is the 95th
# percentile.

# ── returns ─────────────────────────────────────────────────────────────────
from .returns import simple_return
from .returns import log_return
from .returns import cumulative
from .returns import cumulative_by_logs
from .returns import arithmetic_mean
from .returns import geometric_mean
from .returns import volatility_drag
from .returns import annualise
from .returns import to_period_return
from .returns import holding_period_return

# ── risk ────────────────────────────────────────────────────────────────────
from .risk import standard_deviation
from .risk import downside_deviation
from .risk import sortic
from .risk import sharpe
from .risk import drawdowns
from .risk import maximum_drawdown
from .risk import historical_var
from .risk import expected_shortfall
from .risk import tail_dependence_note
from .risk import portfolio_volatility
from .risk import weighted_average
from .risk import DrawdownReport

# ── portfolio ───────────────────────────────────────────────────────────────
from .portfolio import Portfolio
from .portfolio import equal_weight
from .portfolio import from_capital
from .portfolio import expected_return
from .portfolio import volatility
from .portfolio import minimum_variance_weights
from .portfolio import efficient_portfolio
from .portfolio import rebalance
from .portfolio import turnover
from .portfolio import equal_weight_turnover
from .portfolio import trailing_returns

comptime VERSION = "0.1.0"
comptime PACKAGE_NAME = "mfin"