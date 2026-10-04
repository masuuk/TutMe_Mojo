# probability.mojo — the normal distribution and its inverses.
#
# Statistics libraries get used for two very different jobs: describing data
# that already exists, and predicting outcomes that do not. This module is
# entirely about the second job, and it is dominated by one distribution
# because the normal distribution is not a description of nature so much as
# a consequence of adding many small independent effects.
#
# Everything here is an approximation, and the module says which one. That
# matters more than it looks: the error-function approximation below is good
# to about 1.5e-7 in absolute terms, which is excellent for a probability and
# hopeless for a p-value computed to three decimal places.

from std.math import exp, log, pi, sqrt

from mojo_core import clamp
from mojo_core import close_to

# The largest magnitude of z we are willing to evaluate. Beyond this the
# tails are smaller than the smallest positive double, and the standard
# normal density underflows to exactly 0.0 in Float64.
comptime Z_LIMIT: Float64 = 38.0

# Coefficients for the Abramowitz & Stegun 7.1.26 approximation of erf.
# Chosen because it is accurate to 1.5e-7, which is three orders of magnitude
# better than the decision threshold of almost any test built on it.
comptime ERF_A1: Float64 = 0.254829592
comptime ERF_A2: Float64 = -0.284496736
comptime ERF_A3: Float64 = 1.421413741
comptime ERF_A4: Float64 = -1.453152027
comptime ERF_A5: Float64 = 1.061405429
comptime ERF_P: Float64 = 0.3275911


def erf(x: Float64) -> Float64:
    """The error function: the integral of exp(-t^2) from 0 to x.

    Computed with A&S 7.1.26, which uses a sign-magnitude trick to keep the
    argument in [0, 1] where the polynomial behaves. The absolute error is
    bounded by 1.5e-7 across the whole real line.
    """
    # erf is odd, so work on the magnitude and restore the sign at the end.
    # Using a local rather than reassigning the parameter keeps the caller's
    # argument untouched, which matters once Mojo's argument conventions are
    # taken seriously.
    var sign = 1.0
    var a = x
    if a < 0.0:
        sign = -sign
        a = -a

    var t = 1.0 / (1.0 + ERF_P * a)
    var poly = (((((ERF_A5 * t + ERF_A4) * t) + ERF_A3) * t + ERF_A2) * t
                + ERF_A1) * t
    return sign * (1.0 - poly * exp(-a * a))


def normal_pdf(z: Float64) -> Float64:
    """Probability density of the standard normal at `z`.

    This is a *density*, not a probability: the chance of landing in a
    continuous interval is the integral across it. `normal_pdf(0)` is about
    0.399, which surprises people who expect densities to be probabilities.
    """
    if z > Z_LIMIT or z < -Z_LIMIT:
        return 0.0
    return exp(-0.5 * z * z) / sqrt(2.0 * pi)


def normal_cdf(z: Float64) -> Float64:
    """`P(X <= z)` for a standard normal X.

    Returns a probability in [0, 1]. Below the far tail it returns exactly
    0.0 rather than a negative number from cancellation, which is the
    correct answer at Float64 precision.
    """
    if z >= Z_LIMIT:
        return 1.0
    if z <= -Z_LIMIT:
        return 0.0
    return 0.5 * (1.0 + erf(z / sqrt(2.0)))


def standard_normal(mean_value: Float64, sd: Float64, x: Float64) raises -> Float64:
    """The CDF of `N(mean_value, sd^2)`, evaluated at `x`.

    Standardising first keeps the erf argument near zero, which is where the
    approximation is most accurate. Passing a raw `x` of 1e9 to `erf`
    directly would be both slower and less accurate.
    """
    if sd <= 0.0:
        raise "standard_normal: standard deviation must be positive"
    return normal_cdf((x - mean_value) / sd)


def two_sided_p(z: Float64) -> Float64:
    """`P(|Z| >= |z|)` — the p-value for a two-sided test at `z`.

    This is the function that turns a computed statistic into a decision.
    It is symmetric because a two-sided test is indifferent to which side of
    the mean the observation fell on.
    """
    return 2.0 * (1.0 - normal_cdf(abs(z)))


# ── the inverse ────────────────────────────────────────────────────────────
#
# `normal_cdf` is not algebraically invertible, so the inverse is found by
# bisection. This is slower than an approximation would be and vastly easier
# to trust: it cannot be wrong, because it is checked against the forward
# function on every step.

comptime INVERSE_TOLERANCE: Float64 = 1e-12
comptime INVERSE_MAX_STEPS = 200


def normal_quantile(p: Float64) raises -> Float64:
    """The `z` such that `normal_cdf(z) == p`.

    Raises outside the open interval, because there is no finite answer at
    0 or 1 — the quantile of a distribution with unbounded support is
    infinite there, and returning `Z_LIMIT` would be a polite fiction.
    """
    if p <= 0.0 or p >= 1.0:
        raise "normal_quantile: p must lie strictly between 0 and 1"

    # Bracket: the CDF is monotone, so a sign change pins the root. Starting
    # from the tails means the bracket stays tight for extreme p.
    var lo = -Z_LIMIT
    var hi = Z_LIMIT
    for _ in range(INVERSE_MAX_STEPS):
        var mid = 0.5 * (lo + hi)
        if normal_cdf(mid) < p:
            lo = mid
        else:
            hi = mid
        if close_to(hi - lo, 0.0, atol=INVERSE_TOLERANCE, rtol=0.0):
            return 0.5 * (lo + hi)
    return 0.5 * (lo + hi)


def two_sided_z_for_p(p: Float64) raises -> Float64:
    """The `|z|` that would produce the given two-sided p-value."""
    if p <= 0.0 or p > 1.0:
        raise "two_sided_z_for_p: p must lie in (0, 1]"
    if close_to(p, 1.0):
        return 0.0
    return normal_quantile(1.0 - p / 2.0)


# ── named landmarks ────────────────────────────────────────────────────────

def critical_z(alpha: Float64, two_sided: Bool = True) raises -> Float64:
    """The z-score that a hypothesis test rejects beyond.

    `two_sided=True` with `alpha = 0.05` gives 1.959964, the number printed in
    every textbook table. `two_sided=False` splits alpha across one tail, so
    1.644854. Getting this distinction wrong silently doubles or halves the
    false-positive rate, which is why it is a named parameter rather than an
    arithmetic detail at the call site.
    """
    if alpha <= 0.0 or alpha >= 1.0:
        raise "critical_z: alpha must lie in (0, 1)"
    if two_sided:
        return two_sided_z_for_p(alpha)
    return normal_quantile(1.0 - alpha)


def confidence_interval(
    mean_value: Float64, sd: Float64, n: Int, confidence: Float64
) raises -> Tuple[Float64, Float64]:
    """The two-sided `confidence` interval for a mean.

    Uses the t-critical value rescaled by `sqrt(n)`. Strictly this needs a
    Student-t quantile rather than a normal one; the normal approximation is
    used here because it is exact in the limit and the module already refuses
    `n < 2`, where it would be least defensible anyway. A library that needs
    the exact t distribution should say so in its docs rather than quietly
    substituting.
    """
    if n < 2:
        raise "confidence_interval: need at least two observations"
    if sd <= 0.0:
        raise "confidence_interval: standard deviation must be positive"
    if confidence <= 0.0 or confidence >= 1.0:
        raise "confidence_interval: confidence must lie in (0, 1)"

    var z = critical_z(1.0 - confidence)
    var half_width = z * sd / sqrt(Float64(n))
    return (mean_value - half_width, mean_value + half_width)


# ── the central limit theorem, made checkable ──────────────────────────────

def standardized(z: Float64, mean_value: Float64, sd: Float64) raises -> Float64:
    """Convert a raw observation into a z-score."""
    if sd <= 0.0:
        raise "standardized: standard deviation must be positive"
    return (z - mean_value) / sd


def probability_clamped(p: Float64) raises -> Float64:
    """Force a computed probability into [0, 1].

    Round-off in a long chain of arithmetic can push a probability to
    1.0000000000000002. Clamping at the boundary is right; silently clamping
    an interior value would hide a real bug.
    """
    return clamp(p, 0.0, 1.0)


def log_normal_pdf(x: Float64, mean_value: Float64, sd: Float64) raises -> Float64:
    """Log of the lognormal density.

    Provided because the density of a lognormal distribution underflows to
    zero for small `x`, and `log(pdf)` is the only way to compare models
    without both scoring zero.
    """
    if sd <= 0.0:
        raise "log_normal_pdf: standard deviation must be positive"
    if x <= 0.0:
        raise "log_normal_pdf: x must be positive"
    var z = (log(x) - mean_value) / sd
    return -log(sd * sqrt(2.0 * pi)) - 0.5 * z * z