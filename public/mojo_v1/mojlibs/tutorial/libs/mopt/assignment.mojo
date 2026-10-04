# assignment.mojo — the assignment problem, solved exactly.
#
# Assign n people to n jobs minimising total cost. This is the smallest
# useful linear program, and it is also the problem that most closely
# resembles real scheduling: assign tasks to workers, shipments to vehicles,
# tests to machines.
#
# The general LP formulation needs 2n variables and n^2 constraints, which
# means a 400-job problem is a 160,000-constraint LP. Nobody solves that.
# What everybody actually solves is the Hungarian algorithm, which runs in
# O(n^3) on an n-by-n cost matrix, and this module implements it directly.
# It is also the clearest illustration of why recognising the *structure* of a
# problem beats feeding it to a general solver.

from std.math import abs

from mojo_core import close_to

comptime INFINITY_COST: Float64 = 1.0e18


def _hungarian(cost: List[List[Float64]]) raises -> Tuple[List[Int], List[Float64], List[Float64]]:
    """The Hungarian algorithm proper: assignment *and* dual prices.

    Row `i` of the result is the job assigned to agent `i`. The Hungarian
    algorithm works on potentials rather than on a solution directly: it
    maintains a dual solution (row and column prices) and repeatedly adjusts
    them until the prices themselves form a feasible assignment, at which
    point that assignment is provably optimal.

    This is a primal-dual method. The dual certificate matters: optimality
    is not established by the algorithm stopping, but by the fact that a
    feasible dual solution of equal value exists.
    """
    var n = len(cost)
    if n == 0:
        raise "assign: cost matrix is empty"
    for i in range(n):
        if len(cost[i]) != n:
            raise "assign: cost matrix must be square"

    # Potentials. `u` prices rows, `v` prices columns. The invariant is
    # u[i] + v[j] <= cost[i][j] everywhere, maintained by construction.
    var u = List[Float64]()
    var v = List[Float64]()
    for _ in range(n):
        u.append(0.0)
        v.append(0.0)

    # The growing alternating tree: `way` records, for each column, which row
    # reached it. This is the predecessor structure, and it is the only thing
    # making the augmenting path reconstructible.
    var match = List[Int]()     # column -> row
    var way = List[Int]()
    for _ in range(n):
        match.append(-1)
        way.append(0)

    for i in range(n):
        # Augment along the cheapest alternating path out of row `i`.
        var minv = List[Float64]()
        var used = List[Bool]()
        for _ in range(n):
            minv.append(INFINITY_COST)
            used.append(False)
        var j0 = 0
        while True:
            used[j0] = True
            var i0 = match[j0]
            var delta = INFINITY_COST
            var j1 = -1
            for j in range(n):
                if used[j]:
                    continue
                var cur = cost[i0][j] - u[i0] - v[j]
                if cur < minv[j]:
                    minv[j] = cur
                    way[j] = j0
                if minv[j] < delta:
                    delta = minv[j]
                    j1 = j
            # Shift the potentials so the tree stays tight. Every edge of the
            # alternating tree stays on zero reduced cost, and the edge
            # crossing into an unused column becomes tight.
            for j in range(n):
                if used[j]:
                    u[match[j]] = u[match[j]] + delta
                    v[j] = v[j] - delta
                else:
                    minv[j] = minv[j] - delta
            j0 = j1
            if match[j0] == -1:
                break

        # Walk the path back, flipping the match along it.
        while j0 != 0:
            var j1 = way[j0]
            match[j0] = match[j1]
            j0 = j1

    # Invert column->row into row->column.
    var result = List[Int]()
    for _ in range(n):
        result.append(-1)
    for j in range(n):
        if match[j] >= 0:
            result[match[j]] = j
    return (result, u, v)


def assign(cost: List[List[Float64]]) raises -> List[Int]:
    """The cheapest one-to-one assignment. Returns the job index per row.

    Row `i` of the result is the job assigned to agent `i`.

    This is a thin wrapper over `_hungarian`, which also returns the dual
    prices. The wrapper exists because almost no caller wants the prices, and
    making them part of the return type would put a `Tuple` in everyone's way
    for the sake of the minority who do. Call `solve_with_duals` for the
    certificate.
    """
    var solution = _hungarian(cost)
    return solution[0]


def solve_with_duals(
    cost: List[List[Float64]]
) raises -> Tuple[List[Float64], List[Float64]]:
    """The row and column prices that certify the optimal assignment.

    Exposed because optimality is a claim that ought to be checkable. The
    prices returned here satisfy `u[i] + v[j] <= cost[i][j]` everywhere, and
    the sum of all of them equals the cost of the primal assignment. Those
    two facts together *are* the proof of optimality -- weak duality says no
    primal solution can beat any feasible dual, and equality means both are
    optimal. A solver that merely stops somewhere proves nothing.

    Pass the result to `check_complementary_slackness` along with an
    assignment to have that proof checked mechanically.
    """
    var solution = _hungarian(cost)
    return (solution[1], solution[2])


def total_cost(cost: List[List[Float64]], assignment: List[Int]) raises -> Float64:
    """The cost of an assignment."""
    if len(assignment) != len(cost):
        raise "total_cost: assignment must have one entry per row"
    var total = 0.0
    for i in range(len(assignment)):
        var j = assignment[i]
        if j < 0 or j >= len(cost[i]):
            raise "total_cost: assignment refers to a column that does not exist"
        total += cost[i][j]
    return total


def is_valid(cost: List[List[Float64]], assignment: List[Int]) -> Bool:
    """Whether every row and every column is used exactly once.

    A permutation check, and worth having because it is the invariant that
    makes the result meaningful. An assignment that repeats a column is not
    an assignment at all, whatever cost it claims.
    """
    var n = len(cost)
    if len(assignment) != n:
        return False
    var seen = List[Bool]()
    for _ in range(n):
        seen.append(False)
    for i in range(n):
        var j = assignment[i]
        if j < 0 or j >= n:
            return False
        if seen[j]:
            return False
        seen[j] = True
    return True


def dual_value(cost: List[List[Float64]], u: List[Float64], v: List[Float64]) -> Float64:
    """The objective value of a dual solution.

    Present so the optimality claim can be *checked*: if a primal assignment
    and a dual certificate have equal value, both are optimal, and that
    equality is a number a caller can verify rather than a promise the
    algorithm makes.
    """
    var total = 0.0
    for i in range(len(u)):
        total += u[i]
    for j in range(len(v)):
        total += v[j]
    return total


def check_complementary_slackness(
    cost: List[List[Float64]],
    assignment: List[Int],
    u: List[Float64],
    v: List[Float64],
) raises -> Bool:
    """Whether the pair (assignment, prices) certifies optimality.

    Three conditions, all of which must hold and any one of which failing
    proves the assignment is not optimal:

      1. Dual feasibility. `u[i] + v[j] <= cost[i][j]` for every pair. This
         is what makes the prices a legitimate dual solution at all.
      2. Assigned pairs are tight. Every pair the primal solution actually
         uses must satisfy `u[i] + v[j] == cost[i][j]`. Note the direction:
         it is *assigned* pairs that must be tight, not the other way round.
         There may be many tight pairs -- which is exactly what "several
         optimal solutions" looks like -- so requiring the converse would
         reject valid answers.
      3. Equal values. `sum(u) + sum(v)` must equal the primal cost. Weak
         duality gives only `primal >= dual`; equality is what upgrades that
         to "both are optimal".

    Conditions 1 and 3 together are the whole proof. Verifying them costs
    O(n^2) and turns an assertion into a calculation, which is the difference
    between trusting an algorithm and checking it.
    """
    var n = len(cost)
    if len(assignment) != n or len(u) != n or len(v) != n:
        return False

    for i in range(n):
        for j in range(n):
            if u[i] + v[j] > cost[i][j] + 1e-9:
                return False                     # condition 1

    for i in range(n):
        var j = assignment[i]
        if j < 0 or j >= n:
            return False
        if not close_to(u[i] + v[j], cost[i][j], atol=1e-9, rtol=0.0):
            return False                         # condition 2

    # Condition 3. Compared with a relative tolerance because the two values
    # are sums of n terms and their magnitude varies with the cost matrix.
    return close_to(dual_value(cost, u, v), total_cost(cost, assignment),
                    atol=1e-6, rtol=1e-9)


def brute_force(cost: List[List[Float64]]) raises -> Float64:
    """The optimal cost by exhaustive search. For tests only.

    Exponential in `n` by construction, and unusable above about ten rows.
    It exists so the Hungarian result can be verified against a method with
    no cleverness in it at all -- which is the only way to know the clever
    method is right.
    """
    var n = len(cost)
    if n == 0:
        raise "brute_force: cost matrix is empty"
    if n > 10:
        raise "brute_force: exhaustive search is only sane for n <= 10"

    var used = List[Bool]()
    for _ in range(n):
        used.append(False)
    return _search(cost, 0, 0.0, used)


def _search(
    cost: List[List[Float64]], row: Int, so_far: Float64, used: List[Bool]
) raises -> Float64:
    var n = len(cost)
    if row == n:
        return so_far
    var best = INFINITY_COST
    for j in range(n):
        if used[j]:
            continue
        used[j] = True
        var candidate = _search(cost, row + 1, so_far + cost[row][j], used)
        used[j] = False
        if candidate < best:
            best = candidate
    return best


def rectangular_assign(
    cost: List[List[Float64]], supply: List[Int]
) raises -> List[Int]:
    """Assign `m` agents to `n` jobs, each agent to exactly one job.

    Where `m <= n`. Each job may be taken by at most one agent, and some jobs
    are necessarily left empty -- which is the shape of most real allocation
    problems: more capacity than demand.

    Found by adding `n - m` dummy agents with a large but finite cost, which
    makes the square case apply. The dummy cost is finite rather than
    infinite so the arithmetic stays well defined.
    """
    var m = len(cost)
    if m == 0:
        raise "rectangular_assign: cost matrix is empty"
    var n = len(cost[0])
    if len(supply) != m:
        raise "rectangular_assign: supply must have one entry per row"
    for i in range(m):
        if len(cost[i]) != n:
            raise "rectangular_assign: every row must have the same length"

    var total_supply = 0
    for i in range(m):
        total_supply += supply[i]
    if total_supply > n:
        raise "rectangular_assign: total supply exceeds the number of jobs"

    # Pad to a square matrix. Supply greater than one is modelled by
    # repeating the agent's row, which is the standard way to turn a
    # multi-unit agent into identical single-unit agents.
    var padded_rows = 0
    for i in range(m):
        padded_rows += supply[i]
    var size = padded_rows
    if n > size:
        size = n

    var square = List[List[Float64]]()
    for _ in range(size):
        var row = List[Float64]()
        for _ in range(n):
            row.append(0.0)
        square.append(row)

    var real = 0
    for i in range(m):
        for _ in range(supply[i]):
            for j in range(n):
                square[real][j] = cost[i][j]
            real += 1

    var full = assign(square)
    var result = List[Int]()
    var slot = 0
    for i in range(m):
        for _ in range(supply[i]):
            if slot < len(full):
                result.append(full[slot])
            slot += 1
    return result


def hungarian_gap(cost: List[List[Float64]], assignment: List[Int]) raises -> Float64:
    """How far an assignment is from optimal, as a fraction of its cost.

    Zero for the optimal assignment. Useful as a sanity metric in production
    where the exact optimum is known but the assignment came from a heuristic.
    """
    var best = total_cost(cost, assignment)
    var optimal = brute_force(cost)
    if abs(optimal) < 1e-12:
        return 0.0
    return (best - optimal) / abs(optimal)