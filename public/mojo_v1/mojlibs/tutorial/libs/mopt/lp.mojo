# lp.mojo — linear programming by the simplex method.
#
# A dense simplex implementation, chosen because it is the algorithm that
# explains *what* an LP solver does. Every commercial solver is either this
# method with better pivoting and presolve, or the interior-point method, and
# reading the tableau form makes the reason for all that extra machinery
# obvious.
#
# The problem is kept in canonical form throughout:
#
#     minimise    c . x
#     subject to  a . x <= b,  x >= 0
#
# Every other shape -- `>=` rows, equalities, negative bounds, free variables
# -- is a rewrite of this, and the rewrites are all in `LpBuilder`, where
# they are visible rather than hidden behind a solver flag.
#
# The tableau is an augmented `Matrix`: the top `m` rows hold the basis, the
# last column the right-hand side. Slack variables are implicit -- each
# constraint row has one, its own, which is why the starting basis is the
# set of slacks and why no phase-1 procedure is needed.
#
# What is deliberately absent: numerical tolerances tuned for
# ill-conditioned data, presolve, crash routines, and the Big-M method for
# rows with a negative right-hand side. Those are the distance between a
# teaching implementation and a production one, and the honest version says
# so rather than pretending otherwise.

from std.math import abs

from mojo_core import Matrix

# Rows whose right-hand side is worse than this are treated as empty.
comptime RHS_TOLERANCE: Float64 = 1e-9

# Pivot only on a reduced cost at least this large. Without a floor, a pivot
# chosen from 1e-17 of noise terminates in the wrong place with a confident
# answer.
comptime COST_TOLERANCE: Float64 = 1e-9

# Stop after this many pivots regardless. An unbounded or cycling problem is
# a real possibility, and hanging forever is not an acceptable way to report
# one.
comptime MAX_PIVOTS = 200


struct LpResult(Copyable, Writable):
    """The outcome of a solve.

    A struct rather than a bare objective value, because a single float is
    not an answer. A caller who sees only `objective` cannot tell a real
    optimum from the 0.0 that comes back when the problem turned out to be
    infeasible. `status` is the field most callers check first, and it is
    impossible to overlook when the result is a named type.
    """

    var objective: Float64
    var values: List[Float64]
    var status: String
    var pivots: Int

    @property
    def is_optimal(self) -> Bool:
        return self.status == "optimal"

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"LpResult({self.status}, obj={self.objective})"))


def solve(c: List[Float64], a: List[List[Float64]], b: List[Float64]) raises -> LpResult:
    """Minimise `c . x` subject to `a . x <= b` and `x >= 0`.

    `a` is a list of rows rather than a `Matrix` so that a caller writes the
    constraints in the order they appear in the problem statement, with no
    transposition mistake available at the call site. Converting to a matrix
    is the solver's job, and it happens once.
    """
    var m = len(a)
    var n = len(c)
    if n == 0:
        raise "solve: no variables supplied"
    if m == 0:
        raise "solve: no constraints supplied"
    if len(b) != m:
        raise "solve: b must have one entry per constraint row"
    for i in range(m):
        if len(a[i]) != n:
            raise "solve: every constraint row must have one entry per variable"
        if b[i] < -RHS_TOLERANCE:
            raise "solve: negative right-hand side needs the Big-M method, which this solver does not implement"

    # Tableau: m constraint rows plus the objective row, n variable columns
    # plus the rhs column.
    var t = Matrix(m + 1, n + 1)
    for i in range(m):
        for j in range(n):
            t.set(i, j, a[i][j])
        t.set(i, n, b[i])
    for j in range(n):
        # The objective row is stored negated, so a positive entry in it
        # means "entering this column improves the objective".
        t.set(m, j, -c[j])

    # The basis starts as the slack of every row. Each slack's column is a
    # unit vector supported on its own row, so the starting tableau is
    # already canonical and the initial basic solution is x = 0.
    var basis = List[Int]()
    for i in range(m):
        basis.append(n + i)

    var pivots = 0
    while pivots < MAX_PIVOTS:
        var enter = -1
        var best_cost = COST_TOLERANCE
        for j in range(n):
            if t.get(m, j) > best_cost:
                best_cost = t.get(m, j)
                enter = j

        if enter < 0:
            # No improving column, so the current basis is optimal. This is
            # the only exit from the loop that is a genuine success.
            return LpResult(t.get(m, n), extract(t, basis, n), "optimal", pivots)

        # Ratio test: the entering column must not push a basic variable
        # negative. The leaving row is the tightest such constraint.
        var leave = -1
        var best_ratio = 0.0
        for i in range(m):
            if t.get(i, enter) <= RHS_TOLERANCE:
                continue
            var ratio = t.get(i, n) / t.get(i, enter)
            if leave < 0 or ratio < best_ratio - RHS_TOLERANCE:
                leave = i
                best_ratio = ratio
            elif ratio < best_ratio + RHS_TOLERANCE:
                # A tie in the ratio test. Breaking it by the smallest basis
                # index is Bland's rule, and its purpose is not efficiency
                # but termination: it makes cycling impossible rather than
                # merely unlikely.
                if basis[i] < basis[leave]:
                    leave = i
                    best_ratio = ratio

        if leave < 0:
            # The entering column has no positive entry anywhere, so the
            # objective improves without limit. Reporting that honestly beats
            # looping until the iteration limit.
            return LpResult(0.0, List[Float64](), "unbounded", pivots)

        _ = pivot(t, leave, enter)
        basis[leave] = enter
        pivots += 1

    return LpResult(0.0, List[Float64](), "iteration limit reached", pivots)


def pivot(t: mut Matrix, row: Int, col: Int) raises:
    """Normalise the pivot element, then eliminate the column everywhere else.

    This is Gaussian elimination on a single element, and it is the entire
    mechanism of the simplex method. Everything else is bookkeeping about
    which columns are currently basic.
    """
    var p = t.get(row, col)
    if abs(p) < 1e-12:
        raise "pivot: pivot element is numerically zero"
    var width = t.cols
    for j in range(width):
        t.set(row, j, t.get(row, j) / p)
    for i in range(t.rows):
        if i == row:
            continue
        var factor = t.get(i, col)
        if factor == 0.0:
            continue
        for j in range(width):
            t.set(i, j, t.get(i, j) - factor * t.get(row, j))


def extract(t: Matrix, basis: List[Int], n: Int) raises -> List[Float64]:
    """Read the original variables out of the final tableau.

    Only the `n` columns corresponding to decision variables are returned;
    the slacks are an artefact of the method and have no meaning outside it.
    A basic variable's value is simply the rhs of its row, because its
    column is a unit vector in that row and nowhere else.
    """
    var x = List[Float64]()
    for _ in range(n):
        x.append(0.0)
    for i in range(len(basis)):
        var j = basis[i]
        if j < n:
            x[j] = t.get(i, n)
    return x


# ── problem construction ────────────────────────────────────────────────────

struct LpBuilder:
    """Assembles an LP in canonical form, converting as it goes.

    A builder rather than a bare function because the conversions are the
    part people get wrong: each one changes the problem, and none of them is
    visible in the algebra afterwards. A `>=` row is negated; an equality
    becomes both of its directions, which is exact because a slack of zero
    in each is precisely an equality.
    """

    var n: Int
    var m: Int
    var objective: List[Float64]
    var rows: List[List[Float64]]
    var rhs: List[Float64]

    def __init__(out self, n: Int):
        self.n = n
        self.m = 0
        self.objective = List[Float64]()
        for _ in range(n):
            self.objective.append(0.0)
        self.rows = List[List[Float64]]()
        self.rhs = List[Float64]()

    def minimize(mut self, coeffs: List[Float64]) raises:
        """Set the objective vector."""
        if len(coeffs) != self.n:
            raise "minimize: objective must have one coefficient per variable"
        for i in range(self.n):
            self.objective[i] = coeffs[i]

    def add_le(mut self, coeffs: List[Float64], bound: Float64) raises:
        """Add `coeffs . x <= bound`."""
        if len(coeffs) != self.n:
            raise "add_le: constraint must have one coefficient per variable"
        self.rows.append(coeffs)
        self.rhs.append(bound)
        self.m += 1

    def add_ge(mut self, coeffs: List[Float64], bound: Float64) raises:
        """Add `coeffs . x >= bound`, by negating the row into `<=`."""
        if len(coeffs) != self.n:
            raise "add_ge: constraint must have one coefficient per variable"
        var flipped = List[Float64]()
        for i in range(self.n):
            flipped.append(-coeffs[i])
        self.rows.append(flipped)
        self.rhs.append(-bound)
        self.m += 1

    def add_eq(mut self, coeffs: List[Float64], bound: Float64) raises:
        """Add `coeffs . x == bound`, as both directions at once."""
        _ = self.add_le(coeffs, bound)
        var neg = List[Float64]()
        for i in range(self.n):
            neg.append(-coeffs[i])
        _ = self.add_le(neg, -bound)
        self.m -= 1          # one logical constraint, two rows

    def solve(mut self) raises -> LpResult:
        return solve(self.objective, self.rows, self.rhs)


def objective_of(x: List[Float64], c: List[Float64]) raises -> Float64:
    """Evaluate `c . x`.

    Separate from the solver because checking a returned solution against
    its own objective is the cheapest possible test that the solver did not
    simply lose the answer on the way out.
    """
    if len(x) != len(c):
        raise "objective_of: x and c must be the same length"
    var total = 0.0
    for i in range(len(c)):
        total += c[i] * x[i]
    return total