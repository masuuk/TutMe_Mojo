# polynomial.mojo — polynomial algebra by coefficient arithmetic.
#
# Representation: a `List[Float64]` from the **highest power down**. So
# `[2.0, -3.0, 1.0]` is `2x^2 - 3x + 1`, and `len(p) - 1` is the degree.
#
# That order is not arbitrary and not the only defensible choice. Two
# arguments settled it:
#
#   * It matches how a polynomial is written on paper, so a coefficient list
#     can be compared against a printed polynomial without a conversion step
#     nobody can check.
#   * It makes synthetic division a subtraction loop, which is why
#     `divide_by_root` below is the whole of polynomial long division rather
#     than an iteration over an inner polynomial.
#
# The alternative -- lowest power first, as arrays store it -- is more
# convenient to compute with and much worse to read. Since a polynomial's
# coefficients are read far more often than they are written, the
# representation optimises for reading.
#
# Two things this module refuses to do:
#
#   * It does not pad. `[1.0, 0.0, 1.0]` has three coefficients and is
#     `x^2 + 1`; it is not the same object as `[1.0, 0.0, 1.0, 0.0]`, and
#     arithmetic trims trailing zeros so the two do not drift.
#   * It does not divide by a constant without complaining. Division by a
#     polynomial of degree zero is scaling, and asking which scaling is
#     ambiguous, so it raises.

def degree(p: List[Float64]) -> Int:
    """The highest power with a non-zero coefficient, or -1 for the zero polynomial.

    -1 rather than 0 for the zero polynomial, because the two are genuinely
    different objects. `[5.0]` is the constant five and has degree 0;
    `[0.0]` is the zero polynomial and has no degree at all. Reporting 0 for
    both would make `degree` unable to answer the one question it exists to
    answer, and would make `is_zero` return False for the zero polynomial --
    which is what it did, until a test asked.
    """
    var n = len(p) - 1
    while n > 0 and p[n] == 0.0:
        n -= 1
    # The loop cannot reach -1: it stops as soon as `n` is 0. So a lone
    # coefficient has to be checked here, or `degree([0.0])` reports a
    # constant.
    if n == 0 and p[0] == 0.0:
        return -1
    return n


def is_zero(p: List[Float64]) -> Bool:
    """Whether every coefficient is zero, including the empty polynomial.

    Empty counts as zero because an empty coefficient list has nothing to
    evaluate to anything, and returning `0.0` for it is the only consistent
    reading of `evaluate`. It also makes `multiply_all([])` -- the empty
    product -- come out as zero rather than as one, which is the other
    defensible convention and is documented on `multiply_all` instead.
    """
    if len(p) == 0:
        return True
    return degree(p) < 0


def trim(p: List[Float64]) -> List[Float64]:
    """Drop trailing zero coefficients.

    Called by every routine that produces a polynomial, so that `x + 1`
    times `x - 1` is `x^2 - 1` with two coefficients rather than three with
    a zero in the middle of nowhere. Without this, degrees drift upward
    through a long expression and `degree` becomes a poor summary.
    """
    var out = List[Float64]()
    for i in range(len(p)):
        out.append(p[i])

    var n = len(out)
    while n > 1 and out[n - 1] == 0.0:
        n -= 1

    var trimmed = List[Float64]()
    for i in range(n):
        trimmed.append(out[i])
    return trimmed


def evaluate(p: List[Float64], x: Float64) -> Float64:
    """`p(x)`, by Horner's rule.

    One multiply and one add per coefficient, and no explicit power is ever
    computed. For large `|x|` this is the difference between working and
    overflowing: `x^100` evaluated directly overflows a double at `x = 1.4`,
    while the polynomial `x^100` does not overflow at all.
    """
    if len(p) == 0:
        return 0.0
    var total = p[0]
    for i in range(1, len(p)):
        total = total * x + p[i]
    return total


def evaluate_all(p: List[Float64], xs: List[Float64]) -> List[Float64]:
    """`p(x)` for every `x`. Provided for symmetry with the other modules."""
    var out = List[Float64]()
    for i in range(len(xs)):
        out.append(evaluate(p, xs[i]))
    return out


def derivative(p: List[Float64]) -> List[Float64]:
    """The formal derivative.

    Constant terms are dropped and the degree falls by one, so the derivative
    of a constant is the zero polynomial rather than a one-element list
    holding `0.0`. That choice means `derivative` can be called twice in a
    row without the caller having to know which case they are in.
    """
    if len(p) <= 1:
        return List[Float64]([0.0])
    var out = List[Float64]()
    var n = len(p) - 1
    for i in range(n):
        var power = Float64(n - i)
        out.append(p[i] * power)
    return trim(out)


def add(a: List[Float64], b: List[Float64]) -> List[Float64]:
    """Sum, aligning coefficients by power.

    The shorter polynomial is treated as having zero coefficients where it
    runs out, so `x^2 + 1` and `x` can be added without the caller padding
    anything. This is the single most common convenience in the module and
    the reason callers do not have to think about degree mismatches.
    """
    var n = len(a)
    if len(b) > n:
        n = len(b)
    var out = List[Float64]()
    for i in range(n):
        var total = 0.0
        if i < len(a):
            total += a[i]
        if i < len(b):
            total += b[i]
        out.append(total)
    return trim(out)


def subtract(a: List[Float64], b: List[Float64]) -> List[Float64]:
    """Difference, aligning coefficients by power."""
    var n = len(a)
    if len(b) > n:
        n = len(b)
    var out = List[Float64]()
    for i in range(n):
        var total = 0.0
        if i < len(a):
            total += a[i]
        if i < len(b):
            total -= b[i]
        out.append(total)
    return trim(out)


def scale(p: List[Float64], factor: Float64) -> List[Float64]:
    """Multiply every coefficient by `factor`."""
    var out = List[Float64]()
    for i in range(len(p)):
        out.append(p[i] * factor)
    return trim(out)


def multiply(a: List[Float64], b: List[Float64]) -> List[Float64]:
    """The product, by the convolution rule.

    `len(a) + len(b) - 1` coefficients, each the sum of every pair of
    coefficients whose powers add to that position. Schoolbook
    multiplication, which is `O(n * m)` and is the right choice at these
    sizes: Karatsuba is faster past roughly 30 coefficients and is not worth
    the extra code in a library that will be read more often than it is
    run.
    """
    if len(a) == 0 or len(b) == 0:
        return List[Float64]([0.0])
    var out = List[Float64]()
    for _ in range(len(a) + len(b) - 1):
        out.append(0.0)

    for i in range(len(a)):
        if a[i] == 0.0:
            continue
        for j in range(len(b)):
            out[i + j] += a[i] * b[j]
    return trim(out)


def multiply_all(ps: List[List[Float64]]) -> List[Float64]:
    """The product of any number of polynomials."""
    var acc = List[Float64]([1.0])
    for i in range(len(ps)):
        acc = multiply(acc, ps[i])
    return acc


def divide_by_root(p: List[Float64], root: Float64) raises -> List[Float64]:
    """The quotient when `p` is divided by `(x - root)`.

    Synthetic division: a single pass, no polynomial arithmetic in the loop.
    The relation is that each quotient coefficient is the running total of
    the current and previous coefficient divided by `(x - root)`, and the
    running total is the remainder.

    The remainder is discarded, which is only safe when `root` really is a
    root. `remainder_of` below returns it, and a caller who has not
    established that should use it first -- otherwise dividing by
    `(x - 2)` a polynomial with no root at 2 yields a plausible quotient and
    a silently wrong answer.
    """
    var n = len(p)
    if n == 0:
        raise "divide_by_root: cannot divide an empty polynomial"
    if n == 1:
        raise "divide_by_root: a constant has no quotient by a linear factor"

    var out = List[Float64]()
    var running = p[0]
    out.append(running)
    for i in range(1, n):
        running = p[i] + root * running
        out.append(running)
    # The last running value is the remainder, not a coefficient.
    var quotient = List[Float64]()
    for i in range(len(out) - 1):
        quotient.append(out[i])
    return trim(quotient)


def remainder_of(p: List[Float64], root: Float64) -> Float64:
    """`p(root)`, computed as the remainder of dividing by `(x - root)`.

    Numerically inferior to `evaluate` for a single point, and much better for
    a root-finding loop: it costs `O(n)` with one multiply and one add per
    coefficient, and it is the same recurrence `divide_by_root` uses, so a
    routine can share the implementation.
    """
    var running = 0.0
    for i in range(len(p)):
        running = running * root + p[i]
    return running


def is_exact_factor(p: List[Float64], root: Float64, tol: Float64 = 1e-12) -> Bool:
    """Whether `p` really vanishes at `root`.

    Cheap, and worth calling before a division that depends on it. The
    alternative is a quotient that is exactly as plausible as a correct one
    and wrong.
    """
    return abs(remainder_of(p, root)) <= tol * (1.0 + abs(evaluate(p, root)))


def roots_of(p: List[Float64], tol: Float64 = 1e-9) raises -> List[Float64]:
    """Every real root, found by repeated synthetic division.

    Works for an arbitrary real polynomial rather than only ones with
    bracketed roots: first peel off every real root it can find by scanning,
    then solve what remains.

    For a quadratic remainder the roots come from the quadratic formula, and
    when the discriminant is negative the remainder has no real roots and
    the function stops. That is the termination condition, and it is exact
    rather than a tolerance: a polynomial of degree `n` has at most `n` real
    roots, so once the remainder has none, there are none left.

    Returns them in an unspecified order, ascending where possible. A
    polynomial's roots have no natural order, and sorting them here would
    imply an ordering guarantee the caller might then rely on for a
    multiplicities-sensitive calculation.
    """
    var work = trim(p)
    var found = List[Float64]()

    # Peel off real roots by scanning for sign changes. A multiple root of
    # even multiplicity is not found by a sign-change scan; that limitation
    # is shared with `roots.find_all_roots` and is inherent to the method.
    var steps = 400
    var lo = -50.0
    var hi = 50.0
    var step_width = (hi - lo) / Float64(steps)

    var x_prev = lo
    var f_prev = evaluate(work, x_prev)
    var brackets = List[Tuple[Float64, Float64]]()

    for i in range(1, steps + 1):
        var x_now = lo + step_width * Float64(i)
        var f_now = evaluate(work, x_now)
        if f_prev == 0.0:
            brackets.append((x_prev, x_prev))
        elif f_prev * f_now < 0.0:
            brackets.append((x_prev, x_now))
        x_prev = x_now
        f_prev = f_now
    if f_prev == 0.0:
        brackets.append((x_prev, x_prev))

    for i in range(len(brackets)):
        var bracket = brackets[i]
        var refined = _bisect_polynomial(work, bracket[0], bracket[1])
        if not is_exact_factor(work, refined, 1e-6):
            continue
        found.append(refined)
        work = divide_by_root(work, refined)

    # Whatever is left has no sign change on the scanned interval.
    if degree(work) == 2:
        var a = work[0]
        var b = work[1]
        var c = work[2]
        var discriminant = b * b - 4.0 * a * c
        if discriminant >= 0.0:
            var root_of_discriminant = discriminant ** 0.5
            found.append((-b + root_of_discriminant) / (2.0 * a))
            found.append((-b - root_of_discriminant) / (2.0 * a))
    elif degree(work) == 1:
        found.append(-work[1] / work[0])

    return found


def _bisect_polynomial(p: List[Float64], lo: Float64, hi: Float64) -> Float64:
    """Bisection on a polynomial, kept here so the module needs no dependency."""
    var a = lo
    var b = hi
    var mid = a
    for _ in range(100):
        mid = 0.5 * (a + b)
        var fmid = evaluate(p, mid)
        if abs(b - a) < 1e-14:
            return mid
        if evaluate(p, a) * fmid < 0.0:
            b = mid
        else:
            a = mid
    return mid


def expand_binomial_power(n: Int, a: Float64, x: Float64) raises -> List[Float64]:
    """The coefficients of `(a + x)^n`, by repeated multiplication.

    Present because it is the one polynomial construction done often enough
    to be worth having and is three lines that everyone writes slightly
    differently.
    """
    if n < 0:
        raise "expand_binomial_power: the exponent must not be negative"
    var acc = List[Float64]([1.0])
    for _ in range(n):
        acc = multiply(acc, [a, 1.0])
    return acc


def constant_term(p: List[Float64]) -> Float64:
    """`p(0)`. The last coefficient, or zero for an empty polynomial."""
    if len(p) == 0:
        return 0.0
    return p[len(p) - 1]


def leading_coefficient(p: List[Float64]) -> Float64:
    """The coefficient of the highest power, which is also the first entry."""
    if len(p) == 0:
        return 0.0
    return p[0]