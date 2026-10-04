# portfolio.mojo — weights, constraints, and the trade-off frontier.
#
# Portfolio construction is an optimisation problem wearing simple clothes.
# This module handles the three things that make it awkward in practice:
#
#   1. Weights are constraints, not preferences. A long-only fund cannot hold
#      a negative weight, and summing to 100% is not a suggestion.
#   2. Expected return and risk cannot both be maximised. There is a whole
#      frontier of trade-offs and the question is where on it to sit.
#   3. Covariance is what makes diversification work, and it is the input
#      people get least right.
#
# What is here is deliberately modest: construction, feasibility checking,
# and the efficient frontier under a mean-variance model. Real portfolio
# optimisation adds constraints for transaction costs, tax, turnover, sector
# limits and tracking error, and each of them changes the answer enough that
# pretending to handle "portfolio optimisation" without them would be
# misleading.

from std.math import abs, sqrt

from mojo_core import Matrix
from mojo_core import close_to

comptime WEIGHT_TOLERANCE: Float64 = 1e-9


struct Portfolio(Copyable, Writable):
    """A set of holdings with weights that sum to one.

    Validated in the constructor rather than at each use, so an invalid
    portfolio cannot exist. The alternative -- checking in every function
    that takes one -- is how a library ends up with four slightly different
    definitions of "valid".
    """

    var weights: List[Float64]
    var names: List[String]

    def __init__(out self, weights: List[Float64]) raises:
        var total = 0.0
        for i in range(len(weights)):
            total += weights[i]
        if len(weights) == 0:
            raise "Portfolio: no holdings supplied"
        if not close_to(total, 1.0, atol=1e-9, rtol=0.0):
            raise "Portfolio: weights must sum to 1"
        for i in range(len(weights)):
            if weights[i] < -1e-12:
                raise "Portfolio: this is a long-only portfolio; weights must be non-negative"
        self.weights = weights
        self.names = List[String]()
        for i in range(len(weights)):
            self.names.append(String(t"asset_{i}"))

    def count(self) -> Int:
        return len(self.weights)

    def weight(self, i: Int) raises -> Float64:
        if i < 0 or i >= len(self.weights):
            raise "weight: holding index out of range"
        return self.weights[i]

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"Portfolio({self.count()} holdings)"))


def equal_weight(n: Int) raises -> Portfolio:
    """`1/n` in every holding. The only allocation needing no forecast."""
    if n <= 0:
        raise "equal_weight: need at least one holding"
    var w = List[Float64]()
    for _ in range(n):
        w.append(1.0 / Float64(n))
    return Portfolio(w)


def from_capital(
    values: List[Float64],
) raises -> Portfolio:
    """Weights proportional to current market value.

    The standard starting point: it requires no view, and rebalancing back to
    it is a buy-and-hold discipline. Every optimiser proposes something else,
    and the difference is the whole argument.
    """
    if len(values) == 0:
        raise "from_capital: no holdings supplied"
    var total = 0.0
    for i in range(len(values)):
        if values[i] < 0.0:
            raise "from_capital: holding values must not be negative"
        total += values[i]
    if close_to(total, 0.0):
        raise "from_capital: holdings are all worth zero"
    var w = List[Float64]()
    for i in range(len(values)):
        w.append(values[i] / total)
    return Portfolio(w)


def expected_return(weights: List[Float64], mu: List[Float64]) raises -> Float64:
    """The weighted mean of the expected returns.

    A linear function of the weights, which is the property that makes the
    efficient frontier a straight line in expected-return space for a fixed
    risk level.
    """
    if len(weights) != len(mu):
        raise "expected_return: one expected return per holding"
    if len(weights) == 0:
        raise "expected_return: no holdings supplied"
    var total = 0.0
    for i in range(len(weights)):
        total += weights[i] * mu[i]
    return total


def volatility(weights: List[Float64], covariance: Matrix) raises -> Float64:
    """`sqrt(w' S w)` -- the portfolio's own volatility.

    Computing this as `sum_i sum_j` rather than forming a matrix product is
    not a micro-optimisation. The quadratic form is the definition, and
    writing it out makes it obvious that `S` must be symmetric and positive
    semi-definite for the result to mean anything.
    """
    var n = len(weights)
    if covariance.rows != n or covariance.cols != n:
        raise "volatility: covariance matrix must be n by n"
    var total = 0.0
    for i in range(n):
        for j in range(n):
            total += weights[i] * covariance.get(i, j) * weights[j]
    if total < -1e-12:
        raise "volatility: covariance matrix is not positive semi-definite"
    if total < 0.0:
        total = 0.0
    return sqrt(total)


def minimum_variance_weights(covariance: Matrix) raises -> List[Float64]:
    """The lowest-risk long-only portfolio, normalised to sum to one.

    Solved by inverting the covariance matrix rather than by an iterative
    optimiser. The unconstrained minimiser is `S^-1 1 / (1' S^-1 1)`, and it
    is exact -- no tolerance, no convergence criterion, nothing to tune.

    It can also be infeasible: a truly long-only minimiser is the solution of
    a quadratic program, and the closed form is only guaranteed optimal when
    every component of `S^-1 1` is non-negative. This function returns the
    formula's answer and checks it is admissible; if it is not, it raises
    rather than returning something negative.
    """
    var n = covariance.rows
    if covariance.cols != n:
        raise "minimum_variance_weights: covariance matrix must be square"

    # Solve S x = 1 for x. Reusing the solver in `mojo_core` keeps the
    # dependency one-directional and avoids a second copy of Gaussian
    # elimination in the codebase.
    var ones = List[Float64]()
    for _ in range(n):
        ones.append(1.0)
    var x = covariance.solve(ones)

    var sum_x = 0.0
    for i in range(n):
        sum_x += x[i]
    if close_to(sum_x, 0.0):
        raise "minimum_variance_weights: the unconstrained solution does not normalise"

    var w = List[Float64]()
    for i in range(n):
        w.append(x[i] / sum_x)
        if w[i] < -WEIGHT_TOLERANCE:
            raise "minimum_variance_weights: the optimal portfolio needs short positions, which this long-only function forbids"
    return w


def efficient_portfolio(
    covariance: Matrix, mu: List[Float64], target_return: Float64
) raises -> List[Float64]:
    """Maximum-return portfolio at a given risk, by diagonal loading.

    The classic two-fund construction: hold the minimum-variance portfolio
    and the maximum-return (all-equity, highest-expected-return) portfolio in
    proportions that hit the target return.

    This is an approximation, and the approximation is the point worth
    knowing. It is exact for two assets and increasingly loose for many,
    because the true frontier is not spanned by those two funds. The method
    survives because it is transparent, needs no iteration, and cannot fail
    to converge -- which is a better trade than accuracy in most
    rebalancing contexts.
    """
    var n = covariance.rows
    if len(mu) != n:
        raise "efficient_portfolio: one expected return per holding"

    var w_min = minimum_variance_weights(covariance)
    var r_min = expected_return(w_min, mu)

    var r_max = mu[0]
    for i in range(1, n):
        if mu[i] > r_max:
            r_max = mu[i]
    if close_to(r_max, r_min):
        raise "efficient_portfolio: every holding has the same expected return, so there is no frontier to trace"

    if target_return < r_min or target_return > r_max:
        raise "efficient_portfolio: target return is outside the achievable range"

    var t = (target_return - r_min) / (r_max - r_min)
    var w = List[Float64]()
    for i in range(n):
        w.append((1.0 - t) * w_min[i] + t * _unit_vector(n)[i])
    return w


def _unit_vector(n: Int) -> List[Float64]:
    var e = List[Float64]()
    for _ in range(n):
        e.append(1.0)
    return e


def rebalance(
    current: List[Float64], target: List[Float64], tolerance: Float64 = 0.0
) raises -> List[Int]:
    """Which holdings to trade, and in which direction.

    Returns +1 for a buy, -1 for a sell, 0 for "already within tolerance".
    The function returns *instructions*, not trades: sizing a trade requires
    prices and account size, which this layer has no business knowing.

    The tolerance is expressed in weight units, so a tolerance of 0.01 means
    "ignore anything under one percent of the portfolio", which is the form
    that maps onto real rebalancing bands and transaction costs.
    """
    if len(current) != len(target):
        raise "rebalance: one current and one target weight per holding"
    if tolerance < 0.0:
        raise "rebalance: tolerance must not be negative"
    var orders = List[Int]()
    for i in range(len(current)):
        var delta = target[i] - current[i]
        if abs(delta) <= tolerance:
            orders.append(0)
        elif delta > 0.0:
            orders.append(1)
        else:
            orders.append(-1)
    return orders


def turnover(current: List[Float64], target: List[Float64]) raises -> Float64:
    """How much of the portfolio changes, counting one-way trades.

    Half the sum of absolute weight changes, *not* the sum. Buying 10% and
    selling 10% is 10% turnover, not 20%: the money leaves one holding and
    arrives at another, and only one side is a purchase.

    Reporting the full sum is the most common error in turnover statistics
    and consistently doubles them.
    """
    if len(current) != len(target):
        raise "turnover: one current and one target weight per holding"
    var total = 0.0
    for i in range(len(current)):
        var d = target[i] - current[i]
        if d < 0.0:
            d = -d
        total += d
    return total / 2.0


def equal_weight_turnover(current: List[Float64]) raises -> Float64:
    """How far a portfolio sits from equal weighting.

    A single number summarising drift. Above about 0.3 the portfolio is
    substantially a bet on the holdings that ran, which is the risk every
    cap-weighted portfolio carries and almost none reports.
    """
    var n = len(current)
    if n == 0:
        raise "equal_weight_turnover: no holdings supplied"
    var target = equal_weight(n)
    return turnover(current, target.weights)


def trailing_returns(
    equity: List[Float64], period: Int
) raises -> List[Float64]:
    """Every trailing `period`-long return from an equity curve.

    The first entry is at index `period`, not 0: a return over a window that
    extends past the start of the data does not exist, and returning a
    partial window would quietly misalign the whole series.
    """
    var n = len(equity)
    if period <= 0:
        raise "trailing_returns: period must be positive"
    if period >= n:
        raise "trailing_returns: period is longer than the equity curve"
    var out = List[Float64]()
    for i in range(period, n):
        if equity[i - period] <= 0.0:
            raise "trailing_returns: equity curve must be positive throughout"
        out.append(equity[i] / equity[i - period] - 1.0)
    return out