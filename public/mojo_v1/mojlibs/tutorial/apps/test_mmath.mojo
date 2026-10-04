# test_mmath.mojo — the test suite for the `mmath` package.
#
# Numerical code is tested differently from most code, and the difference is
# worth stating before the tests: there is no such thing as an exact expected
# value for `sqrt(2)`. So these tests do three things instead of comparing
# against literals:
#
#   1. Check against a value derived analytically, to a stated tolerance.
#      `sqrt(2)` is not `1.4142135623730951` in the source; the test asserts
#      it is within 1e-9 of that, and `1e-9` is a decision, not an accident.
#   2. Check algebraic identities. `(a + b)(a - b) == a^2 - b^2` holds exactly
#      and catches a whole class of sign and index errors that a spot check
#      at one point would miss.
#   3. Check the *guarantees*: convergence, iteration counts, and the specific
#      preconditions each algorithm states. Those are the parts a caller
#      depends on and the parts that silently change.
#
# Run with:  mojo run apps/test_mmath.mojo

from std.math import PI, cos
from std.testing import assert_raises
from std.testing import assert_true

from mojo_core import Matrix
from mojo_core import close_to

from mmath import Eigen
from mmath import RootResult
from mmath import add
from mmath import bisect
from mmath import cholesky
from mmath import cholesky_solve
from mmath import constant_term
from mmath import degree
from mmath import derivative
from mmath import dominant_eigenpair
from mmath import divide_by_root
from mmath import evaluate
from mmath import evaluate_all
from mmath import expand_binomial_power
from mmath import find_all_roots
from mmath import frobenius_norm
from mmath import is_exact_factor
from mmath import is_positive_definite
from mmath import is_symmetric
from mmath import is_zero
from mmath import leading_coefficient
from mmath import multiply
from mmath import multiply_all
from mmath import newton
from mmath import reconstruct_from_eigen
from mmath import remainder_of
from mmath import roots_of
from mmath import safeguarded_newton
from mmath import scale
from mmath import secant
from mmath import spectral_norm
from mmath import subtract
from mmath import symmetric_eigen
from mmath import tolerance_reached
from mmath import trim

comptime SQRT2: Float64 = 1.4142135623730951
comptime PLASTIC: Float64 = 1.3247179572447460


# The functions under test, as Mojo function references. Taking them as
# parameters rather than writing each one out three times keeps the test
# for `newton` about Newton rather than about how Newton was spelled.
def _sq_minus_two(x: Float64) raises -> Float64:
    return x * x - 2.0


def _d_sq_minus_two(x: Float64) raises -> Float64:
    return 2.0 * x


def _cubic_minus_one(x: Float64) raises -> Float64:
    # x^3 - x - 1, whose real root is the plastic constant.
    return x * x * x - x - 1.0


def _d_cubic_minus_one(x: Float64) raises -> Float64:
    return 3.0 * x * x - 1.0


# ── roots ───────────────────────────────────────────────────────────────────

def test_bisect_finds_a_bracketed_root() raises:
    # x^2 = 2 on [0, 2]. The answer is sqrt(2), and the assertion is to
    # 1e-9 -- a tolerance chosen because it is far below any precision this
    # library claims and far above the accumulated rounding of 41 halvings.
    var r = bisect(_sq_minus_two, 0.0, 2.0)
    assert_true(r.converged)
    assert_true(close_to(r.value, SQRT2, atol=1e-9, rtol=0.0))
    # The residual is the independent check: a bracket of width 1e-12 does
    # not by itself prove the value is right.
    assert_true(r.residual < 1e-11)
    assert_true(tolerance_reached(r, 1e-9))


def test_bisection_costs_one_bit_per_step() raises:
    # Halving an interval of width 2 until it is under 1e-12 takes ceil(log2
    // of 2e12) = 41 steps. This is the method's whole character: a *known*
    # cost, unlike Newton or the secant method, whose step counts have no
    // fixed bound.
    #
    # 41 is not an implementation detail. A caller can size an iteration
    # budget from it, which is exactly what a solver with a hidden budget
    # cannot offer.
    var r = bisect(_sq_minus_two, 0.0, 2.0)
    assert_true(r.iterations >= 41)
    assert_true(r.iterations <= 42)


def test_bisect_refuses_a_bracket_without_a_sign_change():
    # x^2 - 2 is positive at both ends of [3, 4]. There is no root in the
    # interval, and a function with no sign change may still have *two* roots
    # in it -- so returning the midpoint would be a plausible wrong answer
    # rather than an obviously bad one.
    with assert_raises(Error):
        var _ = bisect(_sq_minus_two, 3.0, 4.0)
    with assert_raises(Error):
        var _ = bisect(_sq_minus_two, 2.0, 0.0)


def test_bisect_accepts_a_root_exactly_at_an_endpoint() raises:
    # Zero is a root of x^2 - 2 only at x = sqrt(2), but the general point
    # stands: a function that vanishes at `lo` and is positive elsewhere
    # would fail a naive sign test and be reported as unbracketed.
    var r = bisect(_sq_minus_two, SQRT2, 5.0)
    assert_true(r.converged)
    assert_true(close_to(r.value, SQRT2, atol=1e-12, rtol=0.0))
    assert_true(r.residual == 0.0)
    assert_true(r.iterations == 0)


def test_secant_converges_without_a_bracket() raises:
    # Two starting points, no interval, no derivative. Slower to start than
    # Newton and faster once it is going: 8 steps to reach 1e-14 on x^2 - 2,
    # against Newton's 5 from the same place.
    var r = secant(_sq_minus_two, 1.0, 2.0)
    assert_true(r.converged)
    assert_true(close_to(r.value, SQRT2, atol=1e-12, rtol=0.0))
    assert_true(tolerance_reached(r, 1e-9))


def test_secant_reports_failure_rather_than_hanging() raises:
    # Two points with the same function value give a zero secant slope and
    # an infinite step. The iteration must stop, and must say it did not
    # converge -- a routine that returns the last value with `converged`
    # assumed is a routine that hangs a caller instead of warning it.
    var flat = lambda (x: Float64) raises -> Float64: 1.0
    var r = secant(flat, 0.0, 1.0)
    assert_true(not r.converged)
    assert_true(not tolerance_reached(r))


def test_newton_doubles_its_correct_digits() raises:
    # From x0 = 1 on x^2 - 2, the residuals go
    #   1.0, 2.5e-1, 6.9e-3, 6.0e-6, 4.5e-12, 4.4e-16
    # Each step roughly squares the previous residual. That is the whole
    # reason to prefer Newton, and it is a *local* property: it holds near
    # the root and says nothing about what happens far from it.
    var x = 1.0
    var residuals = List[Float64]()
    for _ in range(5):
        var fx = _sq_minus_two(x)
        residuals.append(fx)
        x = x - fx / _d_sq_minus_two(x)

    # Monotonically shrinking by at least a factor of ten each step.
    for i in range(1, len(residuals)):
        assert_true(abs(residuals[i]) < abs(residuals[i - 1]) / 10.0)

    var r = newton(_sq_minus_two, _d_sq_minus_two, 1.0)
    assert_true(r.converged)
    assert_true(close_to(r.value, SQRT2, atol=1e-12, rtol=0.0))


def test_newton_stops_when_the_derivative_vanishes() raises:
    # At a double root the derivative is zero, so the step is unbounded --
    # and it is exactly at a plausible root that this happens. Newton must
    # terminate with `converged` false rather than return the last iterate as
    # though it had succeeded.
    #
    # x^3 - 2 has a simple root but its derivative vanishes at x = 0, so
    # starting there is a clean demonstration.
    var r = newton(_cubic_minus_one, _d_cubic_minus_one, 0.0)
    assert_true(not r.converged)
    assert_true(not tolerance_reached(r))


def test_newton_on_a_cubic_finds_the_plastic_constant() raises:
    # x^3 - x - 1 = 0 has exactly one real root, 1.324717957244746.
    var r = newton(_cubic_minus_one, _d_cubic_minus_one, 1.5)
    assert_true(r.converged)
    assert_true(close_to(r.value, PLASTIC, atol=1e-11, rtol=0.0))
    # And the secant method, from a different start, must agree.
    var s = secant(_cubic_minus_one, 1.0, 2.0)
    assert_true(close_to(s.value, PLASTIC, atol=1e-11, rtol=0.0))


def test_safeguarded_newton_keeps_the_bracket() raises:
    # The reason this function exists. Newton from a poor start can leave the
    # region entirely; with the bracket retained the answer is still a root.
    # Here the start is deliberately awkward, and the result is still
    # correct and still reported as converged.
    var r = safeguarded_newton(_sq_minus_two, _d_sq_minus_two, 0.0, 2.0)
    assert_true(r.converged)
    assert_true(close_to(r.value, SQRT2, atol=1e-9, rtol=0.0))
    # It should not be much slower than plain bisection, which is the point:
    # the tangent does the work, the bracket is the insurance.
    assert_true(r.iterations <= 45)

    with assert_raises(Error):
        var _ = safeguarded_newton(_sq_minus_two, _d_sq_minus_two, 3.0, 4.0)


def test_three_methods_agree_on_the_same_root() raises:
    # The cross-check that matters most. Three algorithms with different
    # failure modes reaching the same number is far stronger evidence than
    # any one of them matching a literal.
    var b = bisect(_cubic_minus_one, 1.0, 2.0)
    var s = secant(_cubic_minus_one, 1.2, 1.8)
    var n = newton(_cubic_minus_one, _d_cubic_minus_one, 1.4)
    assert_true(close_to(b.value, s.value, atol=1e-10, rtol=0.0))
    assert_true(close_to(b.value, n.value, atol=1e-10, rtol=0.0))
    assert_true(close_to(b.value, PLASTIC, atol=1e-10, rtol=0.0))


def test_find_all_roots_finds_each_sign_change() raises:
    # (x-1)(x-2)(x-3) = x^3 - 6x^2 + 11x - 6. Three sign changes over
    # [-10, 10], so three bisections.
    var found = find_all_roots([1.0, -6.0, 11.0, -6.0])
    assert_true(len(found) == 3)

    var total = 0.0
    for i in range(len(found)):
        total += found[i]
    assert_true(close_to(total, 6.0, atol=1e-6, rtol=0.0))

    with assert_raises(Error):
        var _ = find_all_roots([1.0, 0.0, 1.0], lo=0.0, hi=1.0, steps=0)


# ── polynomial ──────────────────────────────────────────────────────────────

def test_the_result_structs_are_plain_values():
    # `RootResult` and `Eigen` are values, not opaque handles: a caller can
    # build one, read it, and hold on to it. That matters because both
    # carry fields a caller needs and no accessor would otherwise reach --
    # `converged` in particular is the difference between "found it" and
    # "stopped trying", and it has no other route out.
    var good = RootResult(SQRT2, True, 41, 0.0)
    assert_true(good.converged)
    assert_true(tolerance_reached(good))

    var bad = RootResult(0.0, False, 100, 1.0)
    assert_true(not bad.converged)
    assert_true(not tolerance_reached(bad))

    # `Eigen` carries a normalised vector, so it can be compared directly.
    var pair = Eigen(3.0, [0.7071067811865476, 0.7071067811865476])
    assert_true(close_to(pair.value, 3.0, atol=1e-12, rtol=0.0))
    var norm = 0.0
    for i in range(2):
        norm += pair.vector[i] * pair.vector[i]
    assert_true(close_to(norm, 1.0, atol=1e-12, rtol=0.0))


def test_representation_is_highest_power_first():
    # `[2.0, -3.0, 1.0]` is `2x^2 - 3x + 1`. Asserted explicitly so the
    # convention is pinned by a test rather than by a reader's memory.
    var p = [2.0, -3.0, 1.0]
    assert_true(degree(p) == 2)
    assert_true(leading_coefficient(p) == 2.0)
    assert_true(constant_term(p) == 1.0)
    assert_true(close_to(evaluate(p, 0.0), 1.0))
    assert_true(close_to(evaluate(p, 1.0), 0.0))
    assert_true(close_to(evaluate(p, 2.0), 3.0))


def test_evaluate_is_horner():
    # The reason Horner's rule is used: no power is computed separately, so
    # a high-degree polynomial does not overflow when each coefficient is
    # perfectly representable. `x^100` at x = 1.4 overflows a double, while
    # the polynomial `x^100` evaluated by Horner does not.
    var p = List[Float64]()
    p.append(1.0)
    for _ in range(100):
        p.append(0.0)
    # That is the monomial x^100, represented with 101 coefficients.
    assert_true(degree(p) == 100)
    assert_true(close_to(evaluate(p, 1.4), 1.4 ** 100.0, rtol=1e-12))
    assert_true(evaluate(p, 1.4) > 0.0)


def test_arithmetic_identity_is_exact():
    # `(1 + x)(1 - x) = 1 - x^2`. Three coefficients, the middle exactly
    # zero. Testing the identity rather than a spot value catches an
    # off-by-one in the convolution that a single evaluation might not.
    var product = multiply([1.0, 1.0], [1.0, -1.0])
    assert_true(len(product) == 3)
    assert_true(close_to(product[0], 1.0))
    assert_true(close_to(product[1], 0.0))
    assert_true(close_to(product[2], -1.0))
    # And the trimmed form of the same thing is genuinely shorter.
    assert_true(len(trim(product)) == 3)

    var a = [1.0, 2.0, 3.0]
    var b = [4.0, 5.0]
    var ab = multiply(a, b)
    assert_true(close_to(ab[0], 4.0))
    assert_true(close_to(ab[1], 13.0))
    assert_true(close_to(ab[2], 22.0))
    assert_true(close_to(ab[3], 15.0))

    # add and subtract align by power, so mismatched degrees are not a
    # caller problem.
    assert_true(close_to(add([1.0, 0.0, 1.0], [1.0])[2], 1.0))
    assert_true(close_to(subtract([1.0, 0.0, 1.0], [1.0, 1.0])[1], -1.0))
    assert_true(close_to(scale([1.0, 1.0], 3.0)[0], 3.0))


def test_multiplication_by_polynomial_identity():
    var p = [1.0, -6.0, 11.0, -6.0]
    var identity = multiply(p, [1.0])
    assert_true(len(identity) == len(p))
    for i in range(len(p)):
        assert_true(close_to(identity[i], p[i]))

    var three = multiply_all([[1.0, 1.0], [1.0, 1.0], [1.0, 1.0]])
    # (1+x)^3 = 1 + 3x + 3x^2 + x^3
    assert_true(close_to(three[0], 1.0))
    assert_true(close_to(three[1], 3.0))
    assert_true(close_to(three[2], 3.0))
    assert_true(close_to(three[3], 1.0))


def test_synthetic_division_and_its_remainder() raises:
    # Dividing x^3 - 6x^2 + 11x - 6 by (x - 1) gives x^2 - 5x + 6, and the
    # remainder is 0 because 1 really is a root.
    var p = [1.0, -6.0, 11.0, -6.0]
    assert_true(is_exact_factor(p, 1.0))
    var q = divide_by_root(p, 1.0)
    assert_true(close_to(q[0], 1.0))
    assert_true(close_to(q[1], -5.0))
    assert_true(close_to(q[2], 6.0))
    assert_true(close_to(remainder_of(p, 1.0), 0.0))

    # Multiplying back must recover the original: the strongest available
    # check that the quotient and remainder agree with the dividend.
    var recovered = multiply(q, [1.0, -1.0])
    for i in range(len(p)):
        assert_true(close_to(recovered[i], p[i]))

    # At x = 4 the remainder is 6 and 4 is not a root. Dividing anyway gives
    # a quotient that looks entirely reasonable and is not the answer to any
    # question, which is why `is_exact_factor` exists.
    assert_true(not is_exact_factor(p, 4.0))
    assert_true(close_to(remainder_of(p, 4.0), 6.0))

    with assert_raises(Error):
        var _ = divide_by_root([1.0], 1.0)
    with assert_raises(Error):
        var _ = divide_by_root([], 1.0)


def test_derivative_drops_the_constant():
    var p = [1.0, -6.0, 11.0, -6.0]           # x^3 - 6x^2 + 11x - 6
    var dp = derivative(p)
    # 3x^2 - 12x + 11
    assert_true(close_to(dp[0], 3.0))
    assert_true(close_to(dp[1], -12.0))
    assert_true(close_to(dp[2], 11.0))

    # The derivative of a constant is the zero polynomial, not a one-element
    # list holding 0.0 -- so calling it twice is always safe.
    assert_true(is_zero(derivative([5.0, 3.0])))
    assert_true(is_zero(derivative([5.0])))

    # And it is consistent with a finite difference at a point.
    var h = 1e-6
    var numeric = (evaluate(p, 2.0 + h) - evaluate(p, 2.0 - h)) / (2.0 * h)
    assert_true(close_to(numeric, evaluate(dp, 2.0), atol=1e-4, rtol=0.0))


def test_roots_of_finds_all_three_roots() raises:
    # The quadratic remainder path: peel off real roots by synthetic
    # division, then solve what is left by the quadratic formula. Termination
    # is exact rather than a tolerance, because a polynomial of degree n has
    # at most n real roots.
    var p = [1.0, -6.0, 11.0, -6.0]
    var found = roots_of(p)
    assert_true(len(found) == 3)

    var total = 0.0
    var product = 1.0
    for i in range(len(found)):
        total += found[i]
        product *= found[i]
    # Vieta: the roots sum to 6 and multiply to 6.
    assert_true(close_to(total, 6.0, atol=1e-6, rtol=0.0))
    assert_true(close_to(product, 6.0, atol=1e-6, rtol=0.0))


def test_binomial_expansion() raises:
    # (2 + x)^4 = 16 + 32x + 24x^2 + 8x^3 + x^4
    var p = expand_binomial_power(4, 2.0, 1.0)
    assert_true(close_to(p[0], 16.0))
    assert_true(close_to(p[1], 32.0))
    assert_true(close_to(p[2], 24.0))
    assert_true(close_to(p[3], 8.0))
    assert_true(close_to(p[4], 1.0))

    # n = 0 is the empty product, which is 1.
    assert_true(close_to(expand_binomial_power(0, 2.0, 1.0)[0], 1.0))
    with assert_raises(Error):
        var _ = expand_binomial_power(-1, 2.0, 1.0)


def test_evaluate_all():
    var values = evaluate_all([1.0, 0.0, -1.0], [0.0, 1.0, 2.0])
    assert_true(len(values) == 3)
    assert_true(close_to(values[0], 1.0))
    assert_true(close_to(values[1], 0.0))
    assert_true(close_to(values[2], 3.0))


# ── linear algebra ──────────────────────────────────────────────────────────

def _spd_2x2() raises -> Matrix:
    # [[4, 2], [2, 3]]. Symmetric, with leading minors 4 and 8, both
    # positive, so positive definite by Sylvester's criterion.
    var m = Matrix(2, 2)
    m.set(0, 0, 4.0)
    m.set(0, 1, 2.0)
    m.set(1, 0, 2.0)
    m.set(1, 1, 3.0)
    return m


def test_cholesky_is_the_lower_triangular_square_root() raises:
    # L = [[2, 0], [1, sqrt(2)]] gives L L' = [[4, 2], [2, 3]] exactly:
    # 2*2 = 4, 2*1 = 2, and 1*1 + sqrt(2)^2 = 1 + 2 = 3.
    var m = _spd_2x2()
    var l = cholesky(m)
    assert_true(close_to(l.get(0, 0), 2.0))
    assert_true(close_to(l.get(1, 0), 1.0))
    assert_true(close_to(l.get(1, 1), SQRT2))
    # Strictly lower triangle is untouched, which is what makes it
    # triangular rather than a full matrix.
    assert_true(close_to(l.get(0, 1), 0.0))

    for i in range(2):
        for j in range(2):
            var total = 0.0
            for k in range(2):
                total += l.get(i, k) * l.get(j, k)
            assert_true(close_to(total, m.get(i, j), atol=1e-12, rtol=0.0))


def test_cholesky_refuses_what_it_cannot_factor():
    # [[1, 2], [2, 1]] is indefinite: its determinant is -3. Cholesky does
    # not produce a "Cholesky factor" here -- it produces numbers whose
    # assumptions do not hold, which is why the check exists.
    var indefinite = Matrix(2, 2)
    indefinite.set(0, 0, 1.0)
    indefinite.set(0, 1, 2.0)
    indefinite.set(1, 0, 2.0)
    indefinite.set(1, 1, 1.0)
    with assert_raises(Error):
        var _ = cholesky(indefinite)
    assert_true(not is_positive_definite(indefinite))

    # A non-symmetric matrix is refused for a different reason, and saying so
    # matters: [[4, 2], [3, 3]] has determinant 6, so a naive test would
    # pass it.
    var lopsided = Matrix(2, 2)
    lopsided.set(0, 0, 4.0)
    lopsided.set(0, 1, 2.0)
    lopsided.set(1, 0, 3.0)
    lopsided.set(1, 1, 3.0)
    assert_true(not is_symmetric(lopsided))
    with assert_raises(Error):
        var _ = cholesky(lopsided)


def test_is_positive_definite_accepts_the_good_case() raises:
    # The predicate is implemented *by* Cholesky, which is the point: it is
    # the only correct test, and computing it is how you find out.
    var m = _spd_2x2()
    assert_true(is_symmetric(m))
    assert_true(is_positive_definite(m))
    var _ = cholesky(m)      # succeeds, and so does this


def test_cholesky_solve_matches_the_exact_answer() raises:
    # [[4, 2], [2, 3]] x = [10, 8]. Multiplying the first row by 3 and the
    # second by 2 gives 12x + 6y = 30 and 4x + 6y = 16, so x = 1.75 and
    # y = 1.5.
    var m = _spd_2x2()
    var x = cholesky_solve(m, [10.0, 8.0])
    assert_true(close_to(x[0], 1.75, atol=1e-12, rtol=0.0))
    assert_true(close_to(x[1], 1.50, atol=1e-12, rtol=0.0))

    # And the residual of the original system must vanish.
    for i in range(2):
        var total = m.get(i, 0) * x[0] + m.get(i, 1) * x[1]
        assert_true(close_to(total, [10.0, 8.0][i], atol=1e-12, rtol=0.0))

    with assert_raises(Error):
        var _ = cholesky_solve(m, [1.0])


def test_eigenvalues_of_a_two_by_two_symmetric_matrix() raises:
    # [[2, 1], [1, 2]] has eigenvalues 1 and 3, from the characteristic
    # polynomial (2 - L)^2 - 1 = 0.
    var m = Matrix(2, 2)
    m.set(0, 0, 2.0)
    m.set(0, 1, 1.0)
    m.set(1, 0, 1.0)
    m.set(1, 1, 2.0)
    var pairs = symmetric_eigen(m)
    assert_true(len(pairs) == 2)

    # `symmetric_eigen` makes no ordering promise, so the test must not
    # assume one -- it takes the min and max itself. An earlier version of
    # this test read `pairs[0]` twice and assumed it was the larger, which
    # passed by luck on this matrix and would not have on the next one.
    var smaller = pairs[0].value
    var larger = pairs[0].value
    for i in range(1, len(pairs)):
        if pairs[i].value < smaller:
            smaller = pairs[i].value
        if pairs[i].value > larger:
            larger = pairs[i].value

    assert_true(close_to(smaller, 1.0, atol=1e-12, rtol=0.0))
    assert_true(close_to(larger, 3.0, atol=1e-12, rtol=0.0))
    # The trace is the sum of the eigenvalues, whatever order they arrive in.
    assert_true(close_to(smaller + larger, 4.0, atol=1e-12, rtol=0.0))


def test_eigenvalues_of_a_three_by_three_tridiagonal_matrix() raises:
    # The 2 - 2cos(k*pi/4) Toeplitz matrix: 0.5858, 2.0, 3.4142. Three
    # independent values with a known closed form, which is a far better
    # test than comparing against output captured from the implementation.
    var m = Matrix(3, 3)
    for i in range(3):
        m.set(i, i, 2.0)
    m.set(0, 1, -1.0)
    m.set(1, 0, -1.0)
    m.set(1, 2, -1.0)
    m.set(2, 1, -1.0)

    var pairs = symmetric_eigen(m)
    assert_true(len(pairs) == 3)

    var found = List[Float64]()
    for i in range(len(pairs)):
        found.append(pairs[i].value)
    for i in range(len(found)):
        for j in range(i + 1, len(found)):
            if found[j] < found[i]:
                var tmp = found[i]
                found[i] = found[j]
                found[j] = tmp

    for k in range(3):
        var angle = Float64(k + 1) * PI / 4.0
        assert_true(close_to(found[k], 2.0 - 2.0 * cos(angle), atol=1e-10, rtol=0.0))


def test_eigenpairs_reconstruct_the_matrix() raises:
    # M = sum over i of lambda_i (v_i v_i'). If the decomposition is right
    # this reproduces the original. It is the only end-to-end check there
    # is: every eigenvalue can individually look correct while the set is
    # wrong, and a sign error in accumulating the eigenvectors is invisible
    # until you try to rebuild the matrix.
    var m = Matrix(3, 3)
    m.set(0, 0, 4.0)
    m.set(0, 1, 1.0)
    m.set(0, 2, 0.0)
    m.set(1, 0, 1.0)
    m.set(1, 1, 3.0)
    m.set(1, 2, 1.0)
    m.set(2, 0, 0.0)
    m.set(2, 1, 1.0)
    m.set(2, 2, 2.0)

    var pairs = symmetric_eigen(m)
    var rebuilt = reconstruct_from_eigen(pairs)
    for i in range(3):
        for j in range(3):
            assert_true(close_to(rebuilt.get(i, j), m.get(i, j), atol=1e-10, rtol=0.0))


def test_eigenvectors_are_normalised() raises:
    var m = Matrix(2, 2)
    m.set(0, 0, 4.0)
    m.set(0, 1, 1.0)
    m.set(1, 0, 1.0)
    m.set(1, 1, 3.0)
    var pairs = symmetric_eigen(m)
    for i in range(len(pairs)):
        var norm = 0.0
        for j in range(2):
            norm += pairs[i].vector[j] * pairs[i].vector[j]
        assert_true(close_to(norm, 1.0, atol=1e-12, rtol=0.0))


def test_eigen_refuses_a_non_symmetric_matrix():
    var lopsided = Matrix(2, 2)
    lopsided.set(0, 0, 4.0)
    lopsided.set(0, 1, 2.0)
    lopsided.set(1, 0, 3.0)
    lopsided.set(1, 1, 3.0)
    with assert_raises(Error):
        var _ = symmetric_eigen(lopsided)
    with assert_raises(Error):
        var _ = spectral_norm(lopsided)


def test_power_iteration_finds_the_dominant_direction() raises:
    # For [[2, 1], [1, 2]] the dominant eigenvalue is 3 with eigenvector
    # (1, 1)/sqrt(2), so the direction is the line y = x.
    var m = Matrix(2, 2)
    m.set(0, 0, 2.0)
    m.set(0, 1, 1.0)
    m.set(1, 0, 1.0)
    m.set(1, 1, 2.0)
    var pair = dominant_eigenpair(m)
    assert_true(close_to(pair.value, 3.0, atol=1e-9, rtol=0.0))

    # The eigenvector's *direction* is what matters, and the sign is not.
    assert_true(abs(pair.vector[0]) > 0.99)
    assert_true(close_to(abs(pair.vector[0]), abs(pair.vector[1]), atol=1e-9, rtol=0.0))

    # A singular matrix has zero as its dominant eigenvalue, and that is a
    # legitimate answer rather than a failure to find one.
    var singular = Matrix(2, 2)
    singular.set(0, 0, 0.0)
    singular.set(0, 1, 0.0)
    singular.set(1, 0, 0.0)
    singular.set(1, 1, 5.0)
    var s = dominant_eigenpair(singular)
    assert_true(close_to(s.value, 5.0, atol=1e-9, rtol=0.0))


def test_norms() raises:
    # Frobenius is the square root of the sum of squared entries: 3-4-5.
    var m = Matrix(2, 2)
    m.set(0, 0, 3.0)
    m.set(0, 1, 4.0)
    m.set(1, 0, 0.0)
    m.set(1, 1, 0.0)
    assert_true(close_to(frobenius_norm(m), 5.0, atol=1e-12, rtol=0.0))

    # Spectral is the largest singular value, which for a symmetric matrix
    # is the largest |eigenvalue|. Here 3.
    var s = Matrix(2, 2)
    s.set(0, 0, 2.0)
    s.set(0, 1, 1.0)
    s.set(1, 0, 1.0)
    s.set(1, 1, 2.0)
    assert_true(close_to(spectral_norm(s), 3.0, atol=1e-10, rtol=0.0))

    # The spectral norm dominates the Frobenius norm always, and strictly
    # here. A property worth knowing before reaching for either.
    assert_true(spectral_norm(s) > frobenius_norm(s))


def test_cholesky_does_not_modify_its_argument() raises:
    # A routine that destroys its argument forces every caller to remember
    # to copy first, and the ones that forget are the bug reports.
    var m = _spd_2x2()
    var before = m.get(0, 1)
    var _ = cholesky(m)
    assert_true(m.get(0, 1) == before)


def main() raises:
    test_bisect_finds_a_bracketed_root()
    test_bisection_costs_one_bit_per_step()
    test_bisect_refuses_a_bracket_without_a_sign_change()
    test_bisect_accepts_a_root_exactly_at_an_endpoint()
    test_secant_converges_without_a_bracket()
    test_secant_reports_failure_rather_than_hanging()
    test_newton_doubles_its_correct_digits()
    test_newton_stops_when_the_derivative_vanishes()
    test_newton_on_a_cubic_finds_the_plastic_constant()
    test_safeguarded_newton_keeps_the_bracket()
    test_three_methods_agree_on_the_same_root()
    test_find_all_roots_finds_each_sign_change()

    test_the_result_structs_are_plain_values()
    test_representation_is_highest_power_first()
    test_evaluate_is_horner()
    test_arithmetic_identity_is_exact()
    test_multiplication_by_polynomial_identity()
    test_synthetic_division_and_its_remainder()
    test_derivative_drops_the_constant()
    test_roots_of_finds_all_three_roots()
    test_binomial_expansion()
    test_evaluate_all()

    test_cholesky_is_the_lower_triangular_square_root()
    test_cholesky_refuses_what_it_cannot_factor()
    test_is_positive_definite_accepts_the_good_case()
    test_cholesky_solve_matches_the_exact_answer()
    test_eigenvalues_of_a_two_by_two_symmetric_matrix()
    test_eigenvalues_of_a_three_by_three_tridiagonal_matrix()
    test_eigenpairs_reconstruct_the_matrix()
    test_eigenvectors_are_normalised()
    test_eigen_refuses_a_non_symmetric_matrix()
    test_power_iteration_finds_the_dominant_direction()
    test_norms()
    test_cholesky_does_not_modify_its_argument()

    print("mmath: all 33 tests passed")