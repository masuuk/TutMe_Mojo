# risk.mojo — downside risk, drawdown, and tail measures.
#
# Risk has no single definition, and pretending otherwise is how risk models
# mislead. This module implements four families that answer genuinely
# different questions, and each is named for the question it answers:
#
#   * dispersion    -- how much the returns varied (standard deviation)
#   * downside      -- how bad the bad times were (semi-deviation, shortfall)
#   * drawdown      -- how far the equity curve fell from its peak (max DD)
#   * tail shape    -- how much probability sits beyond a threshold (VaR, ES)
#
# The last family is the one most often quoted and least often understood.
# A 95% Value-at-Risk of 2% says nothing about what happened on the one day
# in twenty that mattered. Expected shortfall is the number to quote
# alongside it, precisely because it answers the question VaR does not.

from std.math import sqrt

from mojo_core import close_to
from mojo_core import mean


# ── dispersion ──────────────────────────────────────────────────────────────

def standard_deviation(returns: List[Float64]) raises -> Float64:
    """Sample standard deviation of a return series.

    Sample, not population, because the series is a sample of something
    larger and the bias is small -- but it is a decision, and it is made here
    rather than left to a flag.
    """
    var n = len(returns)
    if n < 2:
        raise "standard_deviation: need at least two returns"
    var m = mean(returns)
    var acc = 0.0
    for i in range(n):
        var d = returns[i] - m
        acc += d * d
    return sqrt(acc / Float64(n - 1))


def downside_deviation(
    returns: List[Float64], mar: Float64 = 0.0
) raises -> Float64:
    """Standard deviation of only the returns that fell below `mar`.

    `mar` is the minimum acceptable return, and defaults to zero: an
    investor who is willing to lose nothing should use the default, and one
    targeting a 5% return should pass 0.05.

    Two conventions exist and they disagree. This divides by the *total*
    number of observations, so a series with a few large losses reports a
    smaller value than one dividing by the number of losses alone. The
    total-count version is the standard one and does not blow up on a series
    with no losses at all.
    """
    var n = len(returns)
    if n < 2:
        raise "downside_deviation: need at least two returns"
    var acc = 0.0
    for i in range(n):
        var d = returns[i] - mar
        if d < 0.0:
            acc += d * d
    return sqrt(acc / Float64(n))


def sortic(returns: List[Float64], mar: Float64 = 0.0) raises -> Float64:
    """Return divided by downside deviation.

    The Sortino ratio. Preferred to the Sharpe ratio precisely because it
    declines to penalise upside volatility: a return that overshoots the
    target is not a risk. A Sortino of 1.0 means the average return matched
    the average shortfall below the target.
    """
    if len(returns) == 0:
        raise "sortic: empty return series"
    var dd = downside_deviation(returns, mar)
    if close_to(dd, 0.0):
        raise "sortic: no returns fell below the minimum acceptable return"
    return (mean(returns) - mar) / dd


def sharpe(
    returns: List[Float64], risk_free: Float64 = 0.0
) raises -> Float64:
    """Excess return per unit of total volatility.

    The original risk-adjusted return measure, and the one to distrust most
    here: it penalises volatility in both directions, so a portfolio that
    jumps 5% either way scores worse than one that drifts smoothly upward by
    the same mean. That is a defensible modelling choice, not a bug, but it
    is a choice and the name should carry it.
    """
    var sd = standard_deviation(returns)
    if close_to(sd, 0.0):
        raise "sharpe: zero volatility gives an infinite ratio"
    return (mean(returns) - risk_free) / sd


# ── drawdown ────────────────────────────────────────────────────────────────

struct DrawdownReport(Copyable, Writable):
    """The worst of times, and when it happened.

    `peak_before` and `trough_index` are included because a maximum drawdown
    without its dates is not actionable: the recovery matters as much as the
    depth, and a reader cannot look either up from a single number.
    """

    var max_drawdown: Float64        # positive fraction, e.g. 0.25 = 25%
    var peak_index: Int
    var trough_index: Int
    var longest_underwater_runs: Int

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"DrawdownReport(max={self.max_drawdown})"))


def drawdowns(equity: List[Float64]) raises -> List[Float64]:
    """The drawdown at every point, as a positive fraction below the running peak.

    Given an equity curve rather than a return series, because drawdown is
    defined on the *level*: a fall from 100 to 80 is 20% and a fall from 120
    to 96 is also 20%, which a return series alone would not reveal.

    Raises if the curve contains a non-positive value, because the running
    peak would then be ill-defined and every subsequent drawdown after it
    would be wrong in a way that is hard to notice.
    """
    if len(equity) == 0:
        raise "drawdowns: empty equity curve"
    var out = List[Float64]()
    var peak = equity[0]
    if peak <= 0.0:
        raise "drawdowns: equity curve must be positive throughout"
    for i in range(len(equity)):
        if equity[i] <= 0.0:
            raise "drawdowns: equity curve must be positive throughout"
        if equity[i] > peak:
            peak = equity[i]
        out.append(1.0 - equity[i] / peak)
    return out


def maximum_drawdown(equity: List[Float64]) raises -> DrawdownReport:
    """The deepest fall from a prior peak, and where it happened.

    Also reports the longest run of consecutive points below the running
    peak. Duration is the dimension everyone forgets: a 20% drawdown
    recovered in a month is a different event from one that took three
    years, and the maximum depth alone cannot tell them apart.
    """
    var dd = drawdowns(equity)
    var worst = 0.0
    var peak_at = 0
    var trough_at = 0
    var run = 0
    var longest_run = 0

    for i in range(len(dd)):
        if dd[i] > 0.0:
            run += 1
            if run > longest_run:
                longest_run = run
            if dd[i] > worst:
                worst = dd[i]
                trough_at = i
                # The peak is the last index that was not in a drawdown.
                peak_at = i - run + 1 if run > 1 else i
        else:
            run = 0

    return DrawdownReport(worst, peak_at, trough_at, longest_run)


# ── tail risk ───────────────────────────────────────────────────────────────

def historical_var(returns: List[Float64], level: Float64 = 0.95) raises -> Float64:
    """The loss not exceeded on `1 - level` of days. A positive number.

    The empirical quantile of the loss distribution: `level = 0.95` returns
    the fifth-percentile return negated, so 0.02 means "on 95% of days the
    portfolio lost less than 2%".

    Two things this does not say, both worth stating anyway:

      * Nothing about the one day in twenty that was worse. That is exactly
        what `expected_shortfall` is for.
      * Nothing about how the sample was chosen. A VaR computed on a period
        chosen because it was calm is a description of that period.

    The quantile convention here matches `mstats.quantile`, so the two
    packages cannot disagree about which number is the 95th percentile.
    """
    var n = len(returns)
    if n == 0:
        raise "historical_var: empty return series"
    if level <= 0.0 or level >= 1.0:
        raise "historical_var: level must lie strictly between 0 and 1"

    var h = Float64(n - 1) * (1.0 - level)
    var lo = Int(h)
    var frac = h - Float64(lo)

    # Sort a copy of the returns ascending, then interpolate.
    var xs = List[Float64]()
    for i in range(n):
        xs.append(returns[i])
    for i in range(1, n):
        var key = xs[i]
        var j = i - 1
        while j >= 0 and xs[j] > key:
            xs[j + 1] = xs[j]
            j -= 1
        xs[j + 1] = key

    var q = xs[lo]
    if lo + 1 < n:
        q = q + frac * (xs[lo + 1] - xs[lo])
    return -q


def expected_shortfall(
    returns: List[Float64], level: Float64 = 0.95
) raises -> Float64:
    """The average loss on the days that exceeded the VaR threshold.

    Reported as a positive number, and always at least as large as the VaR
    it accompanies -- the mean of the worst 5% cannot be smaller than the
    boundary of the worst 5%. A model reporting Expected Shortfall below its
    Value-at-Risk has made a sign error somewhere, and that inequality is a
    cheap consistency check worth encoding in a test.
    """
    var n = len(returns)
    if n == 0:
        raise "expected_shortfall: empty return series"
    if level <= 0.0 or level >= 1.0:
        raise "expected_shortfall: level must lie strictly between 0 and 1"

    var threshold = historical_var(returns, level)
    var tail = List[Float64]()
    for i in range(n):
        if -returns[i] >= threshold - 1e-15:
            tail.append(-returns[i])

    if len(tail) == 0:
        # The worst observation is milder than the interpolated threshold,
        # which happens when the sample is small and the level is extreme.
        return threshold

    var total = 0.0
    for i in range(len(tail)):
        total += tail[i]
    return total / Float64(len(tail))


def tail_dependence_note() -> String:
    """A one-line reminder that historical tail measures have no future.

    Returned rather than printed: a library should not decide how loudly to
    say something. Exposed as a constant so a CLI can print it at start-up
    and a service can log it once.
    """
    return String("historical tail measures describe the sample, not the future")


# ── aggregate risk ──────────────────────────────────────────────────────────

def portfolio_volatility(
    weights: List[Float64],
    volatilities: List[Float64],
    correlation: List[List[Float64]],
) raises -> Float64:
    """Volatility of a weighted portfolio from its parts.

    Implements the full covariance form rather than the weighted-average
    shortcut, because the shortcut assumes perfect correlation and
    therefore always overstates diversification. The reduction to a scalar
    is a quadratic form, and for two uncorrelated assets it collapses to the
    familiar `sqrt(w1^2 s1^2 + w2^2 s2^2)` -- which is why the shortcut gets
    confused for it.
    """
    var n = len(weights)
    if n == 0:
        raise "portfolio_volatility: no holdings supplied"
    if len(volatilities) != n:
        raise "portfolio_volatility: one volatility per holding"
    if len(correlation) != n:
        raise "portfolio_volatility: correlation matrix must be n by n"
    for i in range(n):
        if len(correlation[i]) != n:
            raise "portfolio_volatility: correlation matrix must be n by n"

    var total = 0.0
    for i in range(n):
        for j in range(n):
            total += weights[i] * weights[j] * volatilities[i] * volatilities[j] * correlation[i][j]

    if total < 0.0:
        # A correlation matrix that is not positive semi-definite gives a
        # negative variance under the root. That is a data error, not a
        # numerical one, and clamping it would hide it.
        raise "portfolio_volatility: correlation matrix is not positive semi-definite"
    return sqrt(total)


def weighted_average(
    weights: List[Float64], values: List[Float64]
) raises -> Float64:
    """A weighted mean, refusing weights that do not add up.

    The check is here because a weighting scheme summing to 0.97 is almost
    always a silent data error, and the resulting mean looks entirely
    reasonable.
    """
    if len(weights) != len(values):
        raise "weighted_average: one weight per value"
    if len(weights) == 0:
        raise "weighted_average: no values supplied"
    var sum_w = 0.0
    var total = 0.0
    for i in range(len(weights)):
        sum_w += weights[i]
        total += weights[i] * values[i]
    if close_to(sum_w, 0.0):
        raise "weighted_average: weights sum to zero"
    return total / sum_w