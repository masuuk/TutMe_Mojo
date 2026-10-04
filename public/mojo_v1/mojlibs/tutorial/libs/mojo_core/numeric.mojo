# numeric.mojo — tolerances, clamping and unit-safe scalar helpers.
#
# Every library in this tutorial bottoms out here. Numerical code lives or
# dies by how it treats "close enough", so we make that decision once,
# explicitly, instead of re-arguing it in seven packages.

from std.math import isclose, pi

# A relative/absolute tolerance pair. `isclose` treats two numbers as equal
# when they agree to within `atol + rtol * |other|`, which is the right
# shape for quantities that cross many orders of magnitude.
comptime DEFAULT_ATOL: Float64 = 1e-12
comptime DEFAULT_RTOL: Float64 = 1e-9

# Angular conversions. `comptime` folds these into the instruction stream at
# build time, so there is no runtime division by a variable.
comptime DEG_TO_RAD: Float64 = pi / 180.0
comptime RAD_TO_DEG: Float64 = 180.0 / pi
comptime ARCSEC_TO_DEG: Float64 = 1.0 / 3600.0

# Names kept deliberately boring. `abs_diff` is not the same as `abs(a - b)`
# in floating point, and confusing the two is a classic source of silent bugs.


def close_to(
    a: Float64,
    b: Float64,
    atol: Float64 = DEFAULT_ATOL,
    rtol: Float64 = DEFAULT_RTOL,
) -> Bool:
    """True when `a` and `b` agree within the given tolerance.

    Use this in assertions and tolerance checks. Never use `==` on floats.
    """
    return isclose(a, b, atol, rtol)


def clamp(x: Float64, lo: Float64, hi: Float64) raises -> Float64:
    """Constrain `x` to the closed interval `[lo, hi]`.

    Arguments are ordered low, high — the same order as the mathematical
    notation `[lo, hi]` — so the call site reads left to right.
    """
    if lo > hi:
        raise "clamp: lo must not exceed hi"
    if x < lo:
        return lo
    if x > hi:
        return hi
    return x


def lerp(a: Float64, b: Float64, t: Float64) -> Float64:
    """Linear interpolation: `t = 0` gives `a`, `t = 1` gives `b`.

    `t` is intentionally *not* clamped. Extrapolation is a legitimate thing
    to want from a function named `lerp`, and silently folding it back into
    range would make that impossible.
    """
    return a + (b - a) * t


def safe_div(num: Float64, den: Float64, default: Float64 = 0.0) -> Float64:
    """Divide, returning `default` instead of raising when `den` is zero.

    Survey networks, portfolio weights and rate curves all divide by things
    that can legitimately be zero. Making the caller decide what zero means
    is better than an exception that aborts a long computation.
    """
    if den == 0.0:
        return default
    return num / den


def relative_error(actual: Float64, expected: Float64) raises -> Float64:
    """`|actual - expected| / |expected|`.

    Raises on a zero reference value. A relative error against zero has no
    meaningful definition, and returning a sentinel infinity would quietly
    propagate into later comparisons that only test for "large".
    """
    if expected == 0.0:
        raise "relative_error: reference value is zero"
    return abs(actual - expected) / abs(expected)


# ---- unit conversion -------------------------------------------------------

def deg_to_rad(d: Float64) -> Float64:
    return d * DEG_TO_RAD


def rad_to_deg(r: Float64) -> Float64:
    return r * RAD_TO_DEG


def arcseconds_to_deg(sec: Float64) -> Float64:
    return sec * ARCSEC_TO_DEG


# ---- angle helpers ---------------------------------------------------------

def wrap_degrees(a: Float64) -> Float64:
    """Fold an angle in degrees into `[0, 360)`.

    Bearing arithmetic accumulates past 360 all the time. Normalising at the
    boundary keeps comparisons and equality checks meaningful.
    """
    var r = a % 360.0
    if r < 0.0:
        r += 360.0
    return r


def angular_difference_deg(a: Float64, b: Float64) -> Float64:
    """The signed smallest rotation carrying `a` to `b`, in `(-180, 180]`."""
    var d = wrap_degrees(b - a)
    if d > 180.0:
        d -= 360.0
    return d


# ---- numeric summaries -----------------------------------------------------

def mean(values: List[Float64]) raises -> Float64:
    """Arithmetic mean. Raises on an empty input rather than returning 0.0.

    The mean of nothing is not zero; it is undefined. Returning 0.0 would let
    a bug in the caller propagate silently through an entire pipeline, so the
    empty case is an explicit failure.
    """
    if len(values) == 0:
        raise "mean: empty input"
    var total = 0.0
    for i in range(len(values)):
        total += values[i]
    return total / Float64(len(values))


def sum_of_squares(values: List[Float64]) -> Float64:
    """Sum of `x*x` over `values`. The inner loop of every variance routine."""
    var acc = 0.0
    for i in range(len(values)):
        acc += values[i] * values[i]
    return acc