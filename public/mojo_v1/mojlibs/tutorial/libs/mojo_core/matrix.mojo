# matrix.mojo — dense square matrices with LU decomposition.
#
# Everything a solver needs and nothing else: a fixed-capacity dense matrix,
# row-major storage, partial-pivoting LU, and a solve. No BLAS, no
# templates, no runtime-sized allocation. Operations research, statistics
# (least squares) and physics (state-space integration) all need exactly
# this, and a 60-line honest implementation teaches more than a wrapper.
#
# Capacity is a compile-time parameter, so `Matrix[8]` keeps its 64 doubles
# on the stack and the compiler unrolls the inner loops.

from std.math import sqrt

from .numeric import close_to, safe_div

comptime MAX_DIM: Int = 12
comptime LU_PIVOT_EPS: Float64 = 1e-14


struct Matrix:
    """A dense matrix of at most `MAX_DIM` rows and columns.

    The dimension is a run-time field rather than a parameter, so one type
    serves every small problem and callers can pass matrices around without
    the compiler instantiating a new struct per size. The cost is that inner
    loops cannot be fully unrolled; the benefit is a single, simple API.
    """

    var rows: Int
    var cols: Int
    var data: List[Float64]

    def __init__(out self, rows: Int, cols: Int) raises:
        if rows < 0 or cols < 0:
            raise "Matrix: negative dimension"
        if rows > MAX_DIM or cols > MAX_DIM:
            raise String(
                t"Matrix: {rows}x{cols} exceeds MAX_DIM ({MAX_DIM})"
            )
        self.rows = rows
        self.cols = cols
        self.data = List[Float64]()
        # A flat, row-major buffer. `append` returns False only if the list
        # refuses to grow, which cannot happen for a literal-capacity list.
        for _ in range(rows * cols):
            self.data.append(0.0)

    @staticmethod
    def filled(rows: Int, cols: Int, fill: Float64) raises -> Matrix:
        """Construct every entry with the same value.

        A named constructor rather than an overloaded `__init__`, because Mojo
        requires initialisers to take `out self` as their first argument and
        chaining one initialiser to another is not a supported pattern.
        """
        var m = Matrix(rows, cols)
        for i in range(len(m.data)):
            m.data[i] = fill
        return m

    @staticmethod
    def identity(n: Int) raises -> Matrix:
        """An `n x n` identity matrix."""
        var m = Matrix.filled(n, n, 0.0)
        for i in range(n):
            m.set(i, i, 1.0)
        return m

    def index(self, r: Int, c: Int) raises -> Int:
        """Flat row-major index. Bounds-checked in one place."""
        if r < 0 or r >= self.rows or c < 0 or c >= self.cols:
            raise String(t"Matrix: index ({r}, {c}) out of range")
        return r * self.cols + c

    def get(self, r: Int, c: Int) raises -> Float64:
        return self.data[self.index(r, c)]

    def set(mut self, r: Int, c: Int, v: Float64):
        self.data[self.index(r, c)] = v

    def __getitem__(self, rc: Tuple[Int, Int]) raises -> Float64:
        """`m[(r, c)]` — tuple indexing, as the manual demonstrates."""
        return self.get(rc[0], rc[1])

    def __setitem__(mut self, rc: Tuple[Int, Int], v: Float64):
        self.set(rc[0], rc[1], v)

    def __len__(self) -> Int:
        return self.rows

    def row(self, r: Int) raises -> List[Float64]:
        """A copy of row `r`. Copying avoids handing out an alias."""
        if r < 0 or r >= self.rows:
            raise String(t"Matrix.row: {r} out of range")
        var out = List[Float64]()
        for c in range(self.cols):
            out.append(self.data[r * self.cols + c])
        return out

    def column(self, c: Int) raises -> List[Float64]:
        if c < 0 or c >= self.cols:
            raise String(t"Matrix.column: {c} out of range")
        var out = List[Float64]()
        for r in range(self.rows):
            out.append(self.data[r * self.cols + c])
        return out

    def transpose(self) raises -> Matrix:
        var t = Matrix(self.cols, self.rows)
        for r in range(self.rows):
            for c in range(self.cols):
                t.set(c, r, self.data[r * self.cols + c])
        return t

    def determinant(self) raises -> Float64:
        """Determinant by LU with partial pivoting.

        Returns exactly 0.0 for a singular matrix instead of raising. A zero
        determinant is a well-defined answer that callers routinely test for
        (rank-deficient regression, degenerate constraint sets), so it should
        not be an exceptional path.
        """
        if self.rows != self.cols:
            raise "determinant: matrix is not square"
        var n = self.rows
        var a = Matrix(n, n)
        for i in range(len(self.data)):
            a.data[i] = self.data[i]

        var det = 1.0
        for k in range(n):
            # Partial pivot: the largest magnitude entry in the column.
            var p = k
            var best = abs(a.data[k * n + k])
            for i in range(k + 1, n):
                var v = abs(a.data[i * n + k])
                if v > best:
                    best = v
                    p = i
            if best < LU_PIVOT_EPS:
                return 0.0
            if p != k:
                _swap_rows(mut a, k, p, n)
                det = -det
            var pivot = a.data[k * n + k]
            det *= pivot
            for i in range(k + 1, n):
                var f = a.data[i * n + k] / pivot
                a.data[i * n + k] = 0.0
                for j in range(k + 1, n):
                    a.data[i * n + j] -= f * a.data[k * n + j]
        return det

    def solve(mut self, mut b: List[Float64]) raises -> List[Float64]:
        """Solve `self @ x = b` by Gaussian elimination with partial pivoting.

        Both `self` and `b` are taken by `mut` and are overwritten with the
        elimination state. That is the fastest option and a legitimate one for
        a library that documents it — but it means the caller's right-hand
        side is destroyed, which is why the signature makes it obvious. Copy
        first if you need either one to survive.

        Raises on a singular matrix rather than returning nonsense. Silently
        producing huge values from a singular system is one of the worst
        failure modes in numerical software.
        """
        if self.rows != self.cols:
            raise "solve: matrix is not square"
        var n = self.rows
        if len(b) != n:
            raise String(t"solve: rhs has {len(b)} entries, expected {n}")

        # Augmented elimination, in place.
        for k in range(n):
            var p = k
            var best = abs(self.data[k * n + k])
            for i in range(k + 1, n):
                var v = abs(self.data[i * n + k])
                if v > best:
                    best = v
                    p = i
            if best < LU_PIVOT_EPS:
                raise "solve: matrix is singular"
            if p != k:
                _swap_rows(mut self, k, p, n)
                var tb = b[k]
                b[k] = b[p]
                b[p] = tb

            var pivot = self.data[k * n + k]
            for i in range(k + 1, n):
                var f = self.data[i * n + k] / pivot
                self.data[i * n + k] = 0.0
                b[i] -= f * b[k]
                for j in range(k + 1, n):
                    self.data[i * n + j] -= f * self.data[k * n + j]

        # Back substitution.
        var x = List[Float64]()
        for i in range(n):
            x.append(0.0)
        for i in range(n - 1, -1, -1):
            var acc = b[i]
            for j in range(i + 1, n):
                acc -= self.data[i * n + j] * x[j]
            x[i] = safe_div(acc, self.data[i * n + i])
        return x

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"Matrix({self.rows}x{self.cols})"))


@always_inline("builtin")
def _swap_rows(mut m: Matrix, i: Int, j: Int, n: Int):
    """Swap rows `i` and `j` of a square `n x n` matrix."""
    for c in range(n):
        var tmp = m.data[i * n + c]
        m.data[i * n + c] = m.data[j * n + c]
        m.data[j * n + c] = tmp


# ── free functions ──────────────────────────────────────────────────────────

def matmul(a: Matrix, b: Matrix) raises -> Matrix:
    """The matrix product `a @ b`. Dimensions must agree."""
    if a.cols != b.rows:
        raise String(t"matmul: {a.rows}x{a.cols} @ {b.rows}x{b.cols} is undefined")
    var out = Matrix(a.rows, b.cols)
    for r in range(a.rows):
        for c in range(b.cols):
            var acc = 0.0
            for k in range(a.cols):
                acc += a.data[r * a.cols + k] * b.data[k * b.cols + c]
            out.set(r, c, acc)
    return out


def trace(m: Matrix) -> Float64:
    """Sum of the diagonal. Defined for rectangular matrices too."""
    var n = m.rows if m.rows < m.cols else m.cols
    var acc = 0.0
    for i in range(n):
        acc += m.data[i * m.cols + i]
    return acc


def frobenius_norm(m: Matrix) -> Float64:
    """`|m|_F` — the square root of the sum of squared entries."""
    var acc = 0.0
    for i in range(len(m.data)):
        acc += m.data[i] * m.data[i]
    return sqrt(acc)


def is_diagonal(m: Matrix) -> Bool:
    """True when every off-diagonal entry is zero within tolerance."""
    for r in range(m.rows):
        for c in range(m.cols):
            if r != c and not close_to(m.data[r * m.cols + c], 0.0):
                return False
    return True