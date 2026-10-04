# roots.mojo — finding a zero of a function you cannot solve in closed form.
#
# Every algorithm here is iterative, and every iteration scheme has one
# requirement that must be stated rather than assumed:
#
#   bisection   needs a bracket -- a sign change you already know about.
#   secant      needs two starting points, and no bracket.
#   Newton      needs one starting point and a derivative, and it can leave
#               the region where the root lives and never come back.
#
# The bracket is the interesting one. Knowing "the answer is between 1 and 2"
# is real information, and the only method that can convert it into a
# guaranteed answer is the one that uses it. A solver that will walk off into
# the complex plane if you hand it a bad starting point is not solving the
# problem; it is hoping.

from std.math import abs

from mojo_core import close_to


struct RootResult(Copyable, Writable):
    """Where the root is, and how it was found.

    Every field is here for a reason a caller has needed before:

      * `converged` distinguishes "found it" from "stopped trying". A solver
        that returns a number either way, with no way to tell which, is a
        trap: the value looks exactly as plausible in both cases.
      * `iterations` is the diagnostic. A root that took 200 iterations on a
        function that usually takes 5 has a bracket problem, not a root
        problem.
      * `residual` is the independent check. The step size can be small while
        the answer is wrong, if the algorithm stalled; the residual cannot.
    """

    var value: Float64
    var converged: Bool
    var iterations: Int
    var residual: Float64

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"RootResult(x={self.value}, converged={self.converged})"))


# How many times to halve the interval before giving up. 2^-100 is smaller
# than any double can represent distinctly, so no run that is still making
# progress can be stopped by this limit; it exists only to bound a function
# that is converging to something that is not a root.
comptime MAX_BISECTIONS: Int = 100

# Two distinct floats closer than this are the same number to the arithmetic
# that will follow, so a bracket this narrow has collapsed.
comptime NO_PROGRESS: Float64 = 1e-17


def bisect(
    f: def (Float64) raises -> Float64,
    lo: Float64,
    hi: Float64,
    tol: Float64 = 1e-12,
    max_iterations: Int = MAX_BISECTIONS,
) raises -> RootResult:
    """The root bracketed by `[lo, hi]`, by repeated halving.

    Guaranteed to converge when the bracket is valid, and impossible to
    diverge. That guarantee is the entire reason to prefer it: a caller who
    has a bracket has already done the hard part of the work, and this
    function will not throw it away.

    The result is accurate to about `tol` in the *value*, which for a
    monotonically steep function is better than `tol` in the residual and
    for a flat one is worse. The residual on the result is reported so a
    caller who cares can check the other quantity.
    """
    if lo > hi:
        raise "bisect: the lower bound must not exceed the upper"

    var flo = f(lo)
    var fhi = f(hi)

    # An endpoint that is already a root is a legitimate answer, and it must
    # be reported before the sign test -- otherwise a function that is zero
    # exactly at `lo` and positive everywhere else is called unbounded.
    if flo == 0.0:
        return RootResult(lo, True, 0, 0.0)
    if fhi == 0.0:
        return RootResult(hi, True, 0, 0.0)

    # This is the precondition, and it is the caller's responsibility to
    # satisfy it. A function with no sign change on the interval may still
    # have two roots in it, and bisection will silently return one of the
    # wrong ones -- so the failure is loud.
    if flo * fhi > 0.0:
        raise "bisect: the interval does not bracket a root; f(lo) and f(hi) share a sign"

    var a = lo
    var b = hi
    var fa = flo
    var mid = a

    for i in range(max_iterations):
        mid = 0.5 * (a + b)
        var fmid = f(mid)

        if fmid == 0.0:
            return RootResult(mid, True, i + 1, 0.0)
        if abs(b - a) < tol or abs(b - a) < NO_PROGRESS:
            return RootResult(mid, True, i + 1, abs(fmid))

        if fa * fmid < 0.0:
            b = mid
        else:
            a = mid
            fa = fmid

    # Out of iterations without the interval being narrow enough. The value
    # is still the best estimate available, but `converged` is false so the
    # caller knows not to trust it.
    return RootResult(mid, False, max_iterations, abs(f(mid)))


def secant(
    f: def (Float64) raises -> Float64,
    x0: Float64,
    x1: Float64,
    tol: Float64 = 1e-12,
    max_iterations: Int = 100,
) raises -> RootResult:
    """The root near two starting points, by linear interpolation.

    Needs no bracket and no derivative, and converges faster than bisection
    on a well-behaved function -- superlinearly, where bisection is merely
    linear. The cost is that it is not guaranteed to converge at all: it can
    cycle between two points, or take a step so large it leaves any
    neighbourhood of the root and wander off.

    `converged` is therefore not decoration here. It is the difference
    between this function and a routine that hangs.
    """
    var a = x0
    var b = x1
    var fa = f(a)
    var fb = f(b)

    for i in range(max_iterations):
        if fb == 0.0:
            return RootResult(b, True, i, 0.0)

        # The secant slope. A zero denominator means the two points have the
        # same function value, which the method cannot recover from, and
        # trying anyway produces an infinity that then propagates silently.
        var denominator = fb - fa
        if close_to(denominator, 0.0):
            return RootResult(b, False, i, abs(fb))
        if abs(b - a) < NO_PROGRESS:
            return RootResult(b, True, i, abs(fb))

        var next_point = b - fb * (b - a) / denominator
        a = b
        fa = fb
        b = next_point
        fb = f(b)

        if abs(b - a) < tol:
            return RootResult(b, True, i + 1, abs(fb))

    return RootResult(b, False, max_iterations, abs(fb))


def newton(
    f: def (Float64) raises -> Float64,
    df: def (Float64) raises -> Float64,
    x0: Float64,
    tol: Float64 = 1e-12,
    max_iterations: Int = 100,
) raises -> RootResult:
    """The root near `x0`, by tangent iteration.

    Quadratically convergent near a simple root, which makes it the fastest of
    the three by a wide margin once it is close: doubling the number of
    correct digits each step.

    And that is the catch. Quadratic convergence is a local property. From a
    starting point on the wrong side of a local extremum the method walks
    steadily away from the root it could have found, and there is no step
    during which that becomes visible -- each step is locally excellent.
    Newton is the method to use when you already know where the root is, and
    the worst method to use when you do not.

    The derivative vanishing is the specific failure that terminates most
    runs: the step becomes unbounded exactly where the function is flattest,
    which is where a root is most plausible.
    """
    var x = x0
    for i in range(max_iterations):
        var fx = f(x)
        if abs(fx) < tol:
            return RootResult(x, True, i, abs(fx))

        var dfx = df(x)
        # A vanishing derivative means the tangent is horizontal, so the
        # step is infinite. This is not a rare edge case at a multiple root.
        if close_to(dfx, 0.0):
            return RootResult(x, False, i, abs(fx))

        var step = fx / dfx
        x = x - step
        if abs(step) < tol:
            return RootResult(x, True, i + 1, abs(f(x)))

    return RootResult(x, False, max_iterations, abs(f(x)))


def safeguarded_newton(
    f: def (Float64) raises -> Float64,
    df: def (Float64) raises -> Float64,
    lo: Float64,
    hi: Float64,
    tol: Float64 = 1e-12,
    max_iterations: Int = 100,
) raises -> RootResult:
    """Newton's speed with bisection's guarantee.

    The standard fix for Newton's one real weakness. Keep the bracket; on
    every step, take the Newton point if it lands *inside* the bracket and
    fall back to the midpoint otherwise. The bracket is retained by
    construction, so the sequence always converges to a root of `f`, while
    most steps use the tangent and reach that root far faster.

    This is what a production root finder looks like, and the reason is worth
    understanding: a method that converges to *something* in ninety-nine
    percent of cases is not a method, because the remaining percent are the
    cases a user will report as "it hung".
    """
    var flo = f(lo)
    var fhi = f(hi)
    if flo == 0.0:
        return RootResult(lo, True, 0, 0.0)
    if fhi == 0.0:
        return RootResult(hi, True, 0, 0.0)
    if flo * fhi > 0.0:
        raise "safeguarded_newton: the interval does not bracket a root"

    var a = lo
    var b = hi
    var fa = flo
    var x = 0.5 * (a + b)

    for i in range(max_iterations):
        var fx = f(x)
        if abs(fx) < tol or abs(b - a) < tol:
            return RootResult(x, True, i, abs(fx))

        var dfx = df(x)
        if not close_to(dfx, 0.0):
            var candidate = x - fx / dfx
            # The safeguard: only accept a tangent step that stays inside
            # the bracket. Everything else falls back to the midpoint, which
            # at least cannot leave.
            if candidate > a and candidate < b:
                x = candidate
            else:
                x = 0.5 * (a + b)
        else:
            x = 0.5 * (a + b)

        var fnew = f(x)
        if fa * fnew < 0.0:
            b = x
        else:
            a = x
            fa = fnew

    return RootResult(x, False, max_iterations, abs(f(x)))


def find_all_roots(
    coefficients: List[Float64],
    lo: Float64 = -10.0,
    hi: Float64 = 10.0,
    steps: Int = 200,
    tol: Float64 = 1e-9,
) raises -> List[Float64]:
    """Every real root of a polynomial within `[lo, hi]`.

    Scans for sign changes and refines each one with bisection. That misses
    roots of even multiplicity -- a double root touches zero and turns round
    without changing sign -- which is a real limitation and is stated here
    rather than left for a user to discover.

    What it cannot miss is a root outside the interval, which makes the
    interval a parameter rather than a detail. `roots_of_polynomial` in
    `polynomial` is the better tool when the roots are known to be in a
    bounded set, because it does not need a scan.
    """
    if steps <= 0:
        raise "find_all_roots: steps must be positive"
    if len(coefficients) == 0:
        raise "find_all_roots: a zero polynomial has no defined roots"

    var out = List[Float64]()
    var step_width = (hi - lo) / Float64(steps)

    var x_prev = lo
    var f_prev = _horner(coefficients, lo)

    for i in range(1, steps + 1):
        var x_now = lo + step_width * Float64(i)
        var f_now = _horner(coefficients, x_now)

        if f_prev == 0.0:
            out.append(x_prev)
        elif f_prev * f_now < 0.0:
            var r = bisect(
                lambda (x: Float64) raises -> Float64: _horner(coefficients, x),
                x_prev,
                x_now,
                tol,
            )
            if r.converged:
                out.append(r.value)

        x_prev = x_now
        f_prev = f_now

    # An endpoint exactly on a zero is a root too.
    if f_prev == 0.0:
        out.append(x_prev)
    return out


def _horner(coefficients: List[Float64], x: Float64) -> Float64:
    """Evaluate a polynomial by Horner's rule.

    Coefficients run from the highest power down: `[2.0, -3.0, 1.0]` is
    `2x^2 - 3x + 1`. Horner's form multiplies and adds once per coefficient
    instead of computing each power separately, which is both fewer
    operations and far better conditioned -- `x^n` computed directly
    overflows well before the polynomial does.
    """
    var total = coefficients[0]
    for i in range(1, len(coefficients)):
        total = total * x + coefficients[i]
    return total


def tolerance_reached(result: RootResult, tol: Float64 = 1e-9) -> Bool:
    """Whether a result is trustworthy.

    Checks the residual rather than the reported step size, because a result
    can have a tiny step and a large residual if the iteration stalled. The
    function is independent of `RootResult` itself, so a caller can apply a
    tolerance appropriate to their own problem.
    """
    return result.converged and result.residual < tol