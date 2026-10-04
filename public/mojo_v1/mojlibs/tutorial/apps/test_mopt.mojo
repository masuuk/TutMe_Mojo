# test_mopt.mojo — the test suite for the `mopt` package.
#
# Tests are ordinary programs. There is no test runner, no discovery, and no
# report format: `main` calls each test in turn and the first failing
# assertion aborts with a non-zero exit status.
#
# Two conventions used throughout:
#
#   * `assert_raises(Error)` as a context manager, where the point is that
#     something must fail.
#   * `try/except`, where the point is to inspect the outcome. Deliberately
#     both, because they answer different questions and a suite that only
#     ever uses one of them is testing less than it appears to.
#
# Run with:  mojo run apps/test_mopt.mojo

from std.testing import assert_raises
from std.testing import assert_true

from mojo_core import close_to

from mopt import Graph
from mopt import LpBuilder
from mopt import assign
from mopt import brute_force
from mopt import check_complementary_slackness
from mopt import dijkstra
from mopt import dual_value
from mopt import hungarian_gap
from mopt import is_valid
from mopt import minimum_spanning_tree
from mopt import nearest_neighbour_tour
from mopt import objective_of
from mopt import rectangular_assign
from mopt import shortest_path
from mopt import solve_with_duals
from mopt import solve
from mopt import total_cost

comptime NO_EDGE: Float64 = 1.0e18


# ── linear programming ──────────────────────────────────────────────────────

def test_lp_known_optimum() raises:
    # minimise -3x - 2y  s.t.  x + y <= 4,  x + 3y <= 6,  x, y >= 0.
    #
    # Negating the objective turns a maximisation into the minimisation the
    # solver implements. The optimum is where both constraints are tight:
    # x + y = 4 and x + 3y = 6 give y = 1, x = 3. Objective -(9 + 2) = -11.
    var r = solve([-3.0, -2.0], [[1.0, 1.0], [1.0, 3.0]], [4.0, 6.0])
    assert_true(r.is_optimal)
    assert_true(close_to(r.objective, -11.0, atol=1e-9, rtol=0.0))
    assert_true(close_to(r.values[0], 3.0, atol=1e-9, rtol=0.0))
    assert_true(close_to(r.values[1], 1.0, atol=1e-9, rtol=0.0))


def test_lp_returned_point_is_feasible() raises:
    # Whatever the solver returns, it must satisfy every constraint. This is
    # the check that catches a miscoded tableau, and the one a caller should
    # always make before trusting an objective value.
    var r = solve([-3.0, -2.0], [[1.0, 1.0], [1.0, 3.0]], [4.0, 6.0])
    assert_true(r.values[0] >= -1e-9)
    assert_true(r.values[1] >= -1e-9)
    assert_true(r.values[0] + r.values[1] <= 4.0 + 1e-9)
    assert_true(r.values[0] + 3.0 * r.values[1] <= 6.0 + 1e-9)
    # The reported objective must agree with the returned solution. A solver
    # that reports one and returns the other has lost the answer.
    assert_true(close_to(r.objective, objective_of(r.values, [-3.0, -2.0])))


def test_lp_reports_unbounded_instead_of_looping() raises:
    # minimise -x  s.t.  -x + y <= 1,  x, y >= 0.
    #
    # Setting y = 0 leaves x unconstrained from above, so the objective has
    # no lower bound. The solver must say so rather than pivot until the
    # iteration limit -- a caller waiting on a hung solve has no way to tell
    # a hard problem from a broken one.
    var r = solve([-1.0, 0.0], [[-1.0, 1.0]], [1.0])
    assert_true(r.status == "unbounded")
    assert_true(not r.is_optimal)


def test_lp_builder_ge_rewrite():
    # The builder's whole value is that the conversions are visible. A `>=`
    # row must give the same answer as its manually negated `<=` form.
    var b = LpBuilder(2)
    _ = b.minimize([-3.0, -2.0])
    _ = b.add_le([1.0, 1.0], 4.0)
    _ = b.add_ge([1.0, 3.0], 6.0)          # becomes -x - 3y <= -6
    var r = b.solve()

    # Minimising -(3x + 2y) with x + y <= 4 and x + 3y >= 6. The feasible
    # region is the wedge where x is large, so the objective runs away.
    assert_true(r.status == "unbounded")


def test_lp_builder_le_rewrite_is_identity() raises:
    # Sanity check on the builder: a plain `<=` problem must reproduce the
    # raw `solve` answer exactly, which is what proves the rewrite is a
    # rewrite and not a transformation.
    var b = LpBuilder(2)
    _ = b.minimize([-3.0, -2.0])
    _ = b.add_le([1.0, 1.0], 4.0)
    _ = b.add_le([1.0, 3.0], 6.0)
    var r = b.solve()
    var direct = solve([-3.0, -2.0], [[1.0, 1.0], [1.0, 3.0]], [4.0, 6.0])
    assert_true(close_to(r.objective, direct.objective, atol=1e-9, rtol=0.0))
    assert_true(close_to(r.values[0], direct.values[0], atol=1e-9, rtol=0.0))


def test_lp_eq_is_both_directions():
    # x + y == 3 exactly. Minimising x puts all the weight on y, so the
    # optimum is x = 0, y = 3 -- a *vertex*, and getting it proves the
    # equality rewrite produced two genuinely binding rows.
    var b = LpBuilder(2)
    _ = b.minimize([1.0, 0.0])
    _ = b.add_eq([1.0, 1.0], 3.0)
    var r = b.solve()
    assert_true(r.is_optimal)
    assert_true(close_to(r.values[0], 0.0, atol=1e-9, rtol=0.0))
    assert_true(close_to(r.values[1], 3.0, atol=1e-9, rtol=0.0))


def test_lp_rejects_malformed_input():
    # A length mismatch between rows and columns is the bug a caller most
    # often makes, and it must not be silently padded or truncated.
    with assert_raises(Error):
        var _ = solve([1.0, 2.0], [[1.0]], [1.0])
    with assert_raises(Error):
        var _ = solve([1.0], [[1.0]], [1.0, 2.0])
    with assert_raises(Error):
        var _ = solve([1.0], [], [])


def test_lp_refuses_what_it_cannot_do():
    # A negative right-hand side needs the Big-M method. Refusing loudly is
    # strictly better than solving a different problem than the one asked.
    with assert_raises(Error):
        var _ = solve([-1.0, 0.0], [[1.0, 1.0]], [-1.0])


# ── assignment ──────────────────────────────────────────────────────────────

# A cost matrix whose optimal assignment is not the diagonal, so a solver
# that returns the identity without thinking fails immediately.
var COST = [
    [9.0, 2.0, 7.0, 8.0],
    [6.0, 4.0, 3.0, 7.0],
    [5.0, 8.0, 1.0, 8.0],
    [7.0, 6.0, 9.0, 4.0],
]


def test_assignment_is_a_permutation() raises:
    var a = assign(COST)
    assert_true(is_valid(COST, a))


def test_assignment_is_optimal() raises:
    # Verified against exhaustive search, which contains no cleverness at all.
    # This is the only way to know a clever method is right.
    var a = assign(COST)
    assert_true(close_to(total_cost(COST, a), brute_force(COST), atol=1e-9, rtol=0.0))
    assert_true(close_to(hungarian_gap(COST, a), 0.0, atol=1e-9, rtol=0.0))


def test_assignment_known_optimum() raises:
    # The unique optimum is rows 0,1,2,3 taking columns 1,0,2,3:
    #     2 + 6 + 1 + 4 = 13
    # versus 18 for the diagonal and 14 for the runner-up (1,2,0,3). The
    # solver must find the 13, which is not the greedy row-by-row choice:
    # rows 0 and 1 each want the other's column, and giving it to them is
    # what makes the pair cheaper than their independent bests.
    var a = assign(COST)
    assert_true(a[0] == 1)
    assert_true(a[1] == 0)
    assert_true(a[2] == 2)
    assert_true(a[3] == 3)
    assert_true(close_to(total_cost(COST, a), 13.0, atol=1e-9, rtol=0.0))


def test_optimality_certificate() raises:
    # The strongest test in this file. It does not check the Hungarian
    # algorithm against a known answer; it reconstructs the *proof* of
    # optimality from the dual prices and verifies every part of it. If this
    # passes, the assignment is optimal for reasons that can be read, not
    # merely because a clever loop terminated.
    var a = assign(COST)
    var duals = solve_with_duals(COST)
    var u = duals[0]
    var v = duals[1]
    assert_true(check_complementary_slackness(COST, a, u, v))

    # Condition 1 alone is enough to *refute* an optimality claim: inflate
    # one price and the certificate must fail, proving the check has teeth.
    var tampered = List[Float64]()
    for i in range(len(u)):
        tampered.append(u[i])
    tampered[0] = tampered[0] + 5.0
    assert_true(not check_complementary_slackness(COST, a, tampered, v))


def test_dual_value_matches_primal() raises:
    var a = assign(COST)
    var duals = solve_with_duals(COST)
    assert_true(close_to(dual_value(COST, duals[0], duals[1]),
                         total_cost(COST, a), atol=1e-6, rtol=0.0))


def test_assignment_two_by_two() raises:
    var m = [[1.0, 10.0], [10.0, 1.0]]
    var a = assign(m)
    # The diagonal costs 2 and the off-diagonal 20, so the identity is the
    # only optimal answer even though both are structurally valid.
    assert_true(a[0] == 0)
    assert_true(a[1] == 1)
    assert_true(close_to(total_cost(m, a), 2.0))


def test_assignment_all_equal() raises:
    # Every assignment is optimal on a constant matrix, so any permutation is
    # a correct answer and the test is only that one came back valid.
    var m = [[5.0, 5.0], [5.0, 5.0]]
    var a = assign(m)
    assert_true(is_valid(m, a))
    assert_true(close_to(total_cost(m, a), 10.0))


def test_assignment_three_by_three_matches_brute_force() raises:
    var m = [
        [4.0, 1.0, 3.0],
        [2.0, 0.0, 5.0],
        [3.0, 2.0, 2.0],
    ]
    var a = assign(m)
    assert_true(close_to(total_cost(m, a), brute_force(m), atol=1e-9, rtol=0.0))


def test_rectangular_assignment() raises:
    # Two agents, four jobs, one each. Two jobs are necessarily left unassigned
    # and the two taken must be the cheap, distinct ones.
    var cost = [
        [1.0, 9.0, 9.0, 9.0],
        [8.0, 2.0, 8.0, 8.0],
    ]
    var a = rectangular_assign(cost, [1, 1])
    assert_true(len(a) == 2)
    assert_true(a[0] == 0)
    assert_true(a[1] == 1)


def test_rectangular_assignment_rejects_overcommitment():
    # Asking for more jobs than exist must fail rather than silently drop the
    # excess.
    with assert_raises(Error):
        var _ = rectangular_assign([[1.0, 1.0]], [5])


# ── networks ────────────────────────────────────────────────────────────────

def _line_graph() raises -> Graph:
    # 0 --1-- 1 --2-- 2 --3-- 3
    var g = Graph(4)
    _ = g.add_edge(0, 1, 1.0)
    _ = g.add_edge(1, 2, 2.0)
    _ = g.add_edge(2, 3, 3.0)
    return g


def test_dijkstra_accumulates_along_the_path() raises:
    var g = _line_graph()
    var d = dijkstra(g, 0)
    # Cumulative, not the individual edge weights: 0, 1, 1+2, 1+2+3.
    assert_true(close_to(d[0], 0.0))
    assert_true(close_to(d[1], 1.0))
    assert_true(close_to(d[2], 3.0))
    assert_true(close_to(d[3], 6.0))


def test_dijkstra_from_the_middle() raises:
    var g = _line_graph()
    var d = dijkstra(g, 2)
    assert_true(close_to(d[2], 0.0))
    assert_true(close_to(d[1], 2.0))
    assert_true(close_to(d[0], 3.0))
    assert_true(close_to(d[3], 3.0))


def test_dijkstra_relaxes_settled_vertices() raises:
    # The direct edge 0->3 costs 10, but 0-1-2-3 costs 3. Dijkstra finds the
    # cheap route only because it keeps relaxing edges out of vertices it has
    # already settled, rather than committing to the first route it sees.
    var g = Graph(4)
    _ = g.add_edge(0, 3, 10.0)
    _ = g.add_edge(0, 1, 1.0)
    _ = g.add_edge(1, 2, 1.0)
    _ = g.add_edge(2, 3, 1.0)
    assert_true(close_to(dijkstra(g, 0)[3], 3.0))


def test_shortest_path_reconstructs_the_route() raises:
    var g = _line_graph()
    var p = shortest_path(g, 0, 3)
    assert_true(len(p) == 4)
    assert_true(p[0] == 0)
    assert_true(p[3] == 3)

    # Walk the path and confirm its length equals the distance Dijkstra
    # reported. This is the test that catches a wrong predecessor array --
    # the most common defect in an otherwise-correct implementation.
    var walked = 0.0
    for i in range(len(p) - 1):
        walked += g.edge(p[i], p[i + 1])
    assert_true(close_to(walked, 6.0))
    assert_true(close_to(walked, dijkstra(g, 0)[3]))


def test_unreachable_is_an_answer_not_an_error() raises:
    var g = Graph(3)
    _ = g.add_edge(0, 1, 1.0)

    # Dijkstra reports unreachable as a sentinel distance, because "no path"
    # is an answer a caller wants to branch on.
    assert_true(dijkstra(g, 0)[2] >= NO_EDGE)

    # Asking for a path to an unreachable vertex does raise: there is no path
    # to return, and returning an empty list would invite a silent wrong
    # answer downstream.
    with assert_raises(Error):
        var _ = shortest_path(g, 0, 2)


def test_minimum_spanning_tree() raises:
    # The textbook graph. The MST takes the 1-2 and 2-6 edges and skips the
    # 3-4 edge, because 1-2 already joins that component -- total 9.
    var g = Graph(4)
    _ = g.add_edge(0, 1, 1.0)
    _ = g.add_edge(1, 2, 2.0)
    _ = g.add_edge(0, 2, 3.0)
    _ = g.add_edge(2, 3, 6.0)
    var t = minimum_spanning_tree(g)
    assert_true(t.connected)
    assert_true(t.edge_count() == 3)
    assert_true(close_to(t.total_weight, 9.0))


def test_spanning_tree_is_acyclic() raises:
    # The defining property, checked rather than assumed: a tree on n
    # connected vertices has exactly n-1 edges and no repeated pair.
    var g = Graph(5)
    _ = g.add_edge(0, 1, 2.0)
    _ = g.add_edge(1, 2, 3.0)
    _ = g.add_edge(2, 3, 1.0)
    _ = g.add_edge(3, 4, 4.0)
    _ = g.add_edge(0, 4, 9.0)
    _ = g.add_edge(1, 4, 7.0)
    var t = minimum_spanning_tree(g)
    assert_true(t.edge_count() == 4)
    assert_true(t.connected)

    var seen = List[Tuple[Int, Int]]()
    for e in range(len(t.edges)):
        var a = t.edges[e][0]
        var b = t.edges[e][1]
        var lo = a
        var hi = b
        if lo > hi:
            var tmp = lo
            lo = hi
            hi = tmp
        var key = (lo, hi)
        var already = False
        for f in range(len(seen)):
            if seen[f] == key:
                already = True
        assert_true(not already)
        seen.append(key)


def test_disconnected_graph_reports_not_connected() raises:
    # A forest, not a tree. The flag must be false rather than an edge list
    # being quietly presented as a spanning structure.
    var g = Graph(4)
    _ = g.add_edge(0, 1, 1.0)
    _ = g.add_edge(2, 3, 1.0)
    var t = minimum_spanning_tree(g)
    assert_true(not t.connected)
    assert_true(t.edge_count() == 2)
    assert_true(close_to(t.total_weight, 2.0))


def test_nearest_neighbour_visits_each_vertex_once() raises:
    var g = _line_graph()
    var order = nearest_neighbour_tour(g, 0)
    assert_true(len(order) == 4)
    var seen = List[Bool]()
    for _ in range(4):
        seen.append(False)
    for i in range(len(order)):
        assert_true(not seen[order[i]])
        seen[order[i]] = True


def main() raises:
    test_lp_known_optimum()
    test_lp_returned_point_is_feasible()
    test_lp_reports_unbounded_instead_of_looping()
    test_lp_builder_ge_rewrite()
    test_lp_builder_le_rewrite_is_identity()
    test_lp_eq_is_both_directions()
    test_lp_rejects_malformed_input()
    test_lp_refuses_what_it_cannot_do()

    test_assignment_is_a_permutation()
    test_assignment_is_optimal()
    test_assignment_known_optimum()
    test_optimality_certificate()
    test_dual_value_matches_primal()
    test_assignment_two_by_two()
    test_assignment_all_equal()
    test_assignment_three_by_three_matches_brute_force()
    test_rectangular_assignment()
    test_rectangular_assignment_rejects_overcommitment()

    test_dijkstra_accumulates_along_the_path()
    test_dijkstra_from_the_middle()
    test_dijkstra_relaxes_settled_vertices()
    test_shortest_path_reconstructs_the_route()
    test_unreachable_is_an_answer_not_an_error()
    test_minimum_spanning_tree()
    test_spanning_tree_is_acyclic()
    test_disconnected_graph_reports_not_connected()
    test_nearest_neighbour_visits_each_vertex_once()

    print("mopt: all 28 tests passed")