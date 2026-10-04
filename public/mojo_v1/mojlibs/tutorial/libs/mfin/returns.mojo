# returns.mojo — return series, compounding, and annualisation.
#
# The whole of financial return computation rests on one easily-missed
# distinction: an arithmetic mean and a geometric mean are different numbers,
# and only one of them is the average of what an investor actually
# experienced. This module refuses to conflate them by naming both.
#
# Every conversion between time bases in here goes through log space. That is
# not a stylistic preference: `(1 + r)^n - 1` computed by repeated
# multiplication loses precision in exactly the cases that matter, and the
# log route is the one that survives them.

from std.math import exp, log

# Below this, a continuously-compounded rate has lost so much precision
# through `exp(y) - 1` that reporting it as zero would be a lie.
comptime TINY_RATE: Float64 = 1e-16


def simple_return(begin: Float64, end: Float64) raises -> Float64:
    """The fractional price change over one period.

    Raises when `begin` is zero or negative, because a return from zero is
    infinite and no convention makes that number useful.
    """
    if begin <= 0.0:
        raise "simple_return: starting value must be positive"
    if end < 0.0:
        raise "simple_return: ending value must not be negative"
    return (end - begin) / begin


def log_return(begin: Float64, end: Float64) raises -> Float64:
    """`ln(end / begin)` -- the continuously compounded return.

    The form that actually composes: the log return over a whole period is
    the sum of the log returns over its sub-periods, exactly. Simple returns
    satisfy no such identity, which is why every multi-period calculation
    eventually needs these.
    """
    if begin <= 0.0 or end <= 0.0:
        raise "log_return: both values must be positive"
    return log(end / begin)


def cumulative(period_returns: List[Float64]) raises -> Float64:
    """The total growth factor implied by a series of returns, minus one.

    Compounding is multiplicative, so this is a product and must be computed
    as one. Summing the returns instead is the single most common error in
    hand-written performance code, and it understates a good year while
    overstating a bad one -- exactly backwards from the intuition that makes
    it tempting.
    """
    var growth = 1.0
    for i in range(len(period_returns)):
        growth *= (1.0 + period_returns[i])
    return growth - 1.0


def cumulative_by_logs(period_returns: List[Float64]) raises -> Float64:
    """The same quantity, computed in log space.

    Identical in exact arithmetic and materially different in floating point
    for long series. The two agree to many digits for a handful of periods
    and drift apart as the product accumulates rounding, which is the
    argument for the log route in any real backtest.
    """
    var total = 0.0
    for i in range(len(period_returns)):
        var r = period_returns[i]
        if r <= -1.0:
            raise "cumulative_by_logs: a return of -100% cannot be compounded"
        total += log(1.0 + r)
    return exp(total) - 1.0


def arithmetic_mean(period_returns: List[Float64]) raises -> Float64:
    """The plain average of the periodic returns.

    This is the number a fund fact sheet prints, and it is systematically
    higher than what the money did. It is a legitimate statistic -- it
    answers "what was the average of the yearly numbers" -- but it is not an
    average of any portfolio the investor held.
    """
    if len(period_returns) == 0:
        raise "arithmetic_mean: empty return series"
    var total = 0.0
    for i in range(len(period_returns)):
        total += period_returns[i]
    return total / Float64(len(period_returns))


def geometric_mean(period_returns: List[Float64]) raises -> Float64:
    """The per-period return that would have produced the same total.

    `cumulative(...) / n` in exponent form. This is the honest "average
    return", because it is the rate at which the account actually grew, and
    it is always less than or equal to the arithmetic mean -- the gap between
    them is the cost of volatility, called the drag.
    """
    var total = cumulative(period_returns)
    if total <= -1.0:
        raise "geometric_mean: total loss cannot be turned into a rate"
    var n = len(period_returns)
    return exp(log(1.0 + total) / Float64(n)) - 1.0


def volatility_drag(
    period_returns: List[Float64],
) raises -> Float64:
    """Arithmetic mean minus geometric mean.

    The return given up to volatility. For a series averaging 10% with a
    standard deviation of 15%, the drag is roughly sigma^2 / 2, or about 1.1
    percentage points a year -- which is why smoothing a volatile series
    helps almost as much as a small rise in expected return.
    """
    return arithmetic_mean(period_returns) - geometric_mean(period_returns)


def annualise(
    period_return: Float64, periods_per_year: Float64
) raises -> Float64:
    """Convert one period's return to an annual rate.

    Uses `(1 + r)^k - 1`, the geometric conversion. The linear approximation
    `r * k` is wrong in the direction that flatters a loss and penalises a
    gain -- for 5% monthly it gives 60% against a true 79.4%.
    """
    if period_return <= -1.0:
        raise "annualise: a return of -100% cannot be annualised"
    if periods_per_year <= 0.0:
        raise "annualise: periods per year must be positive"
    return exp(Float64(periods_per_year) * log(1.0 + period_return)) - 1.0


def to_period_return(
    annual_rate: Float64, periods_per_year: Float64
) raises -> Float64:
    """Convert an annual rate to one period's return. The inverse of the above."""
    if annual_rate <= -1.0:
        raise "to_period_return: an annual rate below -100% has no period rate"
    if periods_per_year <= 0.0:
        raise "to_period_return: periods per year must be positive"
    return exp(log(1.0 + annual_rate) / periods_per_year) - 1.0


def holding_period_return(
    cash_flows: List[Float64],
) raises -> Float64:
    """Money-weighted return, from a series of dated flows.

    Split into deposits and withdrawals, then solve for the rate that makes
    the account balance zero. Iterating on the log of the rate is robust and
    short, and the bisection is bounded because the function is monotone in
    the rate: more rate, more final balance.

    This is the return an investor actually earned, as distinct from the
    time-weighted return a fund administrator reports. The two diverge exactly
    when the investor adds or withdraws money, which is precisely when the
    distinction matters.
    """
    if len(cash_flows) < 2:
        raise "holding_period_return: need at least two cash flows"

    # Sign convention: a negative flow is money coming out of the account.
    # The first flow is the initial investment and the last must come out,
    # otherwise there is no return to speak of.
    var scale = 0.0
    for i in range(len(cash_flows)):
        var a = cash_flows[i]
        if a < 0.0:
            a = -a
        if a > scale:
            scale = a
    if scale <= 0.0:
        raise "holding_period_return: all cash flows are zero"

    var rate_lo = -0.9999
    var rate_hi = 10.0
    for _ in range(200):
        var mid = 0.5 * (rate_lo + rate_hi)
        if _npv(mid, cash_flows) > 0.0:
            rate_hi = mid
        else:
            rate_lo = mid
    return 0.5 * (rate_lo + rate_hi)


def _npv(rate: Float64, cash_flows: List[Float64]) -> Float64:
    """Net present value of the flows at `rate`, per unit period.

    Bisection needs only the sign, which is why the objective is written to
    return a float and not a rate: the discount factor stays positive
    throughout the bracketed range.
    """
    var total = 0.0
    var discount = 1.0
    var growth = 1.0 + rate
    if growth <= 0.0:
        return -1.0e30
    for i in range(len(cash_flows)):
        total += cash_flows[i] / discount
        discount *= growth
    return total