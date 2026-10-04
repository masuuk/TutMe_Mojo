# linalg.mojo — the factorisations that only work on well-behaved matrices.
#
# `mojo_core` has `Matrix`, `determinant`, `solve` and `trace` -- the
# operations that work on any square matrix. This module has the ones that
# only work on a *particular kind* of square matrix, and the reason each
# restriction exists is the content of this module:
#
#   Cholesky      needs positive definiteness. Exploits symmetry to halve
#                 the work and guarantee a stable result.
#   Jacobi        needs symmetry, and gives a full eigendecomposition.
#   Power method  needs one dominant eigenvalue, and converges to the
#                 eigenvector rather than the eigenvalue.
#
# Each of these is *faster or better behaved* than the general method for
# its restricted input, and each produces nonsense -- rather than an error --
# outside it. That is why every one of them checks its precondition
# explicitly. A Cholesky factorisation of an indefinite matrix does not
# produce a "Cholesky factor" that fails later; it produces numbers that are
# simply the result of the algorithm's assumptions not holding.

from std.math import abs, sqrt

from mojo_core import Matrix
from mojo_core import close_to

# Below this the algorithm has converged to the precision the arithmetic
# supports, and further rotations would be divided by zero.
comptime CONVERGED: Float64 = 1e-14

# Jacobi sweeps until the off-diagonal sum stops changing at all.
comptime MAX_SWEEPS: Int = 100


def is_symmetric(m: Matrix, tol: Float64 = 1e-12) -> Bool:
    """Whether `m` equals its own transpose, to `tol`.

    A tolerance rather than an exact test because a matrix assembled
    numerically from floating-point data is symmetric only up to rounding,
    and demanding exact symmetry would reject every real input.
    """
    if m.rows != m.cols:
        return False
    for i in range(m.rows):
        for j in range(i + 1, m.cols):
            if abs(m.get(i, j) - m.get(j, i)) > tol:
                return False
    return True


def is_positive_definite(m: Matrix) -> Bool:
    """Whether `x' M x > 0` for every non-zero `x`.

    Tested the only way that is correct in practice: Cholesky, which fails
    exactly when a leading principal minor is not positive. Sylvester's
    criterion, that all leading minors are positive, is the theorem behind
    it.

    Computing this is genuinely how you check the precondition -- there is no
    cheaper test, and a matrix that passes a few random vector probes proves
    nothing at all.
    """
    if m.rows != m.cols:
        return False
    if not is_symmetric(m):
        return False
    try:
        var _ = cholesky(m)
    except:
        return False
    return True


def cholesky(m: Matrix) raises -> Matrix:
    """The lower-triangular `L` with `L L' == m`.

    For a positive-definite symmetric `m`, this is the matrix square root's
    lower half. Roughly half the arithmetic of a general factorisation, and
    it cannot produce an indefinite result -- which is the deeper reason to
    use it: a Cholesky factorisation either succeeds and is correct, or
    fails, and there is no third outcome to detect.

    The recurrence is the reason it is called "the square root made
    practical". Row by row, working inward from the diagonal:

        L[i][j] = (m[i][j] - sum of L[i][k] L[j][k] for k < j) / L[j][j]

    and on the diagonal, with the sum running over `j` itself:

        L[i][i] = sqrt(m[i][i] - sum of L[i][k]^2 for k < i)

    Raises when the matrix is not positive definite. Not because a
    square root of a negative number is impossible -- it is merely complex --
    but because the caller asked for a factorisation that exists only under
    the assumption, and quietly returning complex numbers would hide that the
    assumption failed.
    """
    var n = m.rows
    if m.cols != n:
        raise "cholesky: the matrix must be square"
    if not is_symmetric(m):
        raise "cholesky: the matrix must be symmetric"
    if n == 0:
        raise "cholesky: the matrix must have at least one row"

    var l = Matrix(n, n)
    l.set(0, 0, 0.0)

    for i in range(n):
        for j in range(i + 1):
            var total = m.get(i, j)
            for k in range(j):
                total -= l.get(i, k) * l.get(j, k)
            if i == j:
                if total <= 0.0:
                    raise "cholesky: the matrix is not positive definite"
                l.set(i, j, sqrt(total))
            else:
                var pivot = l.get(j, j)
                if close_to(pivot, 0.0):
                    raise "cholesky: a zero pivot means the matrix is not positive definite"
                l.set(i, j, total / pivot)
    return l


def cholesky_solve(m: Matrix, b: List[Float64]) raises -> List[Float64]:
    """Solve `M x = b` for a symmetric positive-definite `M`.

    Factors, solves two triangular systems, and multiplies back: `M = L L'`
    means `L y = b` then `L' x = y`, and each step is `O(n^2)` forward or
    backward substitution.

    Worth doing this way rather than calling a general solver because the
    factorisation is computed once and is provably stable -- Gaussian
    elimination without pivoting on a positive-definite matrix works, but
    "works" is a different standard from "provably does not lose accuracy".
    """
    var n = m.rows
    if len(b) != n:
        raise "cholesky_solve: one right-hand side per row"
    var l = cholesky(m)

    # Forward substitution: L y = b.
    var y = List[Float64]()
    for i in range(n):
        var total = b[i]
        for k in range(i):
            total -= l.get(i, k) * y[k]
        y.append(total / l.get(i, i))

    # Back substitution: L' x = y.
    var x = List[Float64]()
    for i in range(n):
        x.append(0.0)
    for i in range(n - 1, -1, -1):
        var total = y[i]
        for k in range(i + 1, n):
            total -= l.get(k, i) * x[k]
        x[i] = total / l.get(i, i)
    return x


struct Eigen(Copyable, Writable):
    """One eigenpair: an eigenvalue and its eigenvector.

    The eigenvector is normalised to unit length, so the pair is what most
    code actually wants. An unnormalised eigenvector can be scaled by any
    factor without changing its meaning, which makes it useless as a
    comparison target.
    """

    var value: Float64
    var vector: List[Float64]

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"Eigen({self.value})"))


def symmetric_eigen(
    m: Matrix, max_sweeps: Int = MAX_SWEEPS
) raises -> List[Eigen]:
    """Every eigenvalue and eigenvector of a symmetric matrix, by Jacobi rotations.

    Jacobi repeatedly rotates the basis to zero the largest off-diagonal
    entry, and after enough sweeps the matrix is diagonal -- the diagonal
    entries are then the eigenvalues, and the accumulated rotations give the
    eigenvectors.

    Slow to converge compared with QR or divide-and-conquer, and
    unconditionally the most accurate method there is. Each step is a
    similarity transform, so the eigenvalues are preserved exactly in exact
    arithmetic: the iteration changes the *representation*, not the answer.
    That is why the accuracy does not degrade with the number of sweeps,
    which is the opposite of what iterative methods usually do.

    The rotation is the familiar one. For the `(p, q)` pair with `apq != 0`,
    the angle that zeroes `a[p][q]` is `theta = (a[q][q] - a[p][p]) / (2 a[p][q])`
    and the rotation uses `t = sign(theta) / (|theta| + sqrt(1 + theta^2))`.
    `sign` rather than plain `theta` because the sign of `t` matters: the
    choice that gives `|t| < 1` keeps the rotation small, and a small
    rotation preserves more precision.
    """
    var n = m.rows
    if m.cols != n:
        raise "symmetric_eigen: the matrix must be square"
    if not is_symmetric(m):
        raise "symmetric_eigen: the matrix must be symmetric"
    if n == 0:
        raise "symmetric_eigen: the matrix must have at least one row"

    # Work on a copy: the caller's matrix is not modified, because a
    # factorisation routine that destroys its argument is a routine whose
    # callers all have to remember to copy first.
    var a = Matrix(n, n)
    for i in range(n):
        for j in range(n):
            a.set(i, j, m.get(i, j))

    # V accumulates the rotations and ends as the eigenvector matrix: its
    # columns are the eigenvectors. Starting from the identity is what makes
    # that true.
    var v = Matrix(n, n)
    for i in range(n):
        v.set(i, i, 1.0)

    for _ in range(max_sweeps):
        var off = 0.0
        for i in range(n):
            for j in range(i + 1, n):
                off += a.get(i, j) * a.get(i, j)
        if off < CONVERGED:
            break

        for p in range(n - 1):
            for q in range(p + 1, n):
                var apq = a.get(p, q)
                if abs(apq) < 1e-300:
                    continue

                var theta = (a.get(q, q) - a.get(p, p)) / (2.0 * apq)
                var sign_theta = 1.0
                if theta < 0.0:
                    sign_theta = -1.0
                var t = sign_theta / (abs(theta) + sqrt(1.0 + theta * theta))
                var c = 1.0 / sqrt(1.0 + t * t)
                var s = t * c

                # A = G' A G for the Jacobi rotation G on rows and columns
                # p, q. The `k not in (p, q)` loop is skipped because those
                # entries are provably unchanged, which is the entire source
                # of the method's advantage over a general similarity.
                for k in range(n):
                    if k == p or k == q:
                        continue
                    var akp = a.get(k, p)
                    var akq = a.get(k, q)
                    a.set(k, p, c * akp - s * akq)
                    a.set(p, k, a.get(k, p))
                    a.set(k, q, s * akp + c * akq)
                    a.set(q, k, a.get(k, q))

                var app = a.get(p, p)
                var aqq = a.get(q, q)
                a.set(p, p, c * c * app - 2.0 * s * c * apq + s * s * aqq)
                a.set(q, q, s * s * app + 2.0 * s * c * apq + c * c * aqq)
                a.set(p, q, 0.0)
                a.set(q, p, 0.0)

                for k in range(n):
                    var vkp = v.get(k, p)
                    var vkq = v.get(k, q)
                    v.set(k, p, c * vkp - s * vkq)
                    v.set(k, q, s * vkp + c * vkq)

    var out = List[Eigen]()
    for j in range(n):
        var vector = List[Float64]()
        var norm = 0.0
        for i in range(n):
            vector.append(v.get(i, j))
            norm += v.get(i, j) * v.get(i, j)
        norm = sqrt(norm)
        for i in range(n):
            vector[i] = vector[i] / norm
        out.append(Eigen(a.get(j, j), vector))
    return out


def dominant_eigenpair(
    m: Matrix, iterations: Int = 500, tol: Float64 = 1e-12
) raises -> Eigen:
    """The largest-magnitude eigenvalue and its direction, by power iteration.

    Multiply a vector by the matrix repeatedly and normalise. The result
    converges to the eigenvector of the largest-magnitude eigenvalue, because
    that component grows fastest under repeated multiplication.

    It needs only matrix-vector products, which for a large sparse matrix is
    dramatically cheaper than a factorisation -- and that is the entire
    reason this method exists. For a small dense matrix, `symmetric_eigen`
    is better in every respect except memory.

    Two conditions it needs and does not check:

      * **A single dominant eigenvalue.** If two are equal in magnitude the
        iteration converges to a combination of both, and the result depends
        on the starting vector rather than being wrong in any way you can
        detect afterwards.
      * **Convergence.** It has no fixed-point guarantee. On a matrix with no
        dominant eigenvalue -- a rotation, say -- it cycles forever, which is
        why `converged` is reported rather than implied.
    """
    var n = m.rows
    if m.cols != n:
        raise "dominant_eigenpair: the matrix must be square"
    if n == 0:
        raise "dominant_eigenpair: the matrix must have at least one row"

    # Start from all ones, which has no reason to be orthogonal to any
    # eigenvector -- a deliberate choice, since starting orthogonal to the
    # dominant one would find the second-largest instead and never say so.
    var x = List[Float64]()
    for _ in range(n):
        x.append(1.0 / sqrt(Float64(n)))

    var previous = x
    var value = 0.0

    for _ in range(iterations):
        # y = M x
        var y = List[Float64]()
        for i in range(n):
            var total = 0.0
            for j in range(n):
                total += m.get(i, j) * x[j]
            y.append(total)

        var norm = 0.0
        for i in range(n):
            norm += y[i] * y[i]
        norm = sqrt(norm)
        if close_to(norm, 0.0):
            # M annihilated the vector, which means it is singular and the
            # dominant eigenvalue is zero. Returning the zero vector with a
            # zero eigenvalue is correct, and returning nothing is not.
            return Eigen(0.0, previous)

        var next = List[Float64]()
        for i in range(n):
            next.append(y[i] / norm)

        # The Rayleigh quotient gives the eigenvalue from the current
        # direction: x'Mx with x unit length. Cheaper and more accurate than
        # any ratio of successive iterates.
        value = 0.0
        for i in range(n):
            value += x[i] * y[i]

        var movement = 0.0
        for i in range(n):
            movement += (next[i] - x[i]) * (next[i] - x[i])
        x = next
        previous = next
        if sqrt(movement) < tol:
            break

    return Eigen(value, previous)


def frobenius_norm(m: Matrix) -> Float64:
    """The square root of the sum of every squared entry.

    The natural length of a matrix, and the one that satisfies the triangle
    inequality and the parallelogram law, so it is the norm to use when
    asking "how far apart are these two matrices".
    """
    var total = 0.0
    for i in range(m.rows):
        for j in range(m.cols):
            var v = m.get(i, j)
            total += v * v
    return sqrt(total)


def spectral_norm(m: Matrix) raises -> Float64:
    """The largest singular value: `sqrt(largest eigenvalue of m'm)`.

    The operator norm. It bounds how much the matrix can stretch a vector,
    which makes it the right measure for a numerical error bound --
    perturbing the entries by `e` changes the output by at most
    `spectral_norm * e`.
    """
    var n = m.rows
    if m.cols != n:
        raise "spectral_norm: the matrix must be square"
    if not is_symmetric(m):
        raise "spectral_norm: use singular_values for a non-symmetric matrix"

    var pairs = symmetric_eigen(m)
    var worst = 0.0
    for i in range(len(pairs)):
        if abs(pairs[i].value) > worst:
            worst = abs(pairs[i].value)
    return sqrt(worst)


def reconstruct_from_eigen(pairs: List[Eigen]) raises -> Matrix:
    """Rebuild `M` from an eigenbasis, as a check on the decomposition.

    `M = sum over i of lambda_i * (v_i v_i')`. If the decomposition is right
    this reproduces the original matrix, and comparing the two is the only
    end-to-end verification available -- every individual eigenvalue can look
    right while the set is wrong.

    Included because that check is cheap and because it is the test that
    catches a sign error in the eigenvector accumulation, which is otherwise
    invisible: the eigenvalues would still be right and only the directions
    would be wrong.
    """
    if len(pairs) == 0:
        raise "reconstruct_from_eigen: no eigenpairs supplied"
    var n = len(pairs[0].vector)
    var out = Matrix(n, n)
    for k in range(len(pairs)):
        var lambda = pairs[k].value
        var v = pairs[k].vector
        if len(v) != n:
            raise "reconstruct_from_eigen: every eigenvector must have the same length"
        for i in range(n):
            for j in range(n):
                out.set(i, j, out.get(i, j) + lambda * v[i] * v[j])
    return out