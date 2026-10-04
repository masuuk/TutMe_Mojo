# demo_mopt.mojo — a deterministic tour of the operations research package.
#
# Three problems, each chosen because its answer is arithmetic you can check:
# a two-variable LP, a four-by-four assignment, and a graph shortest path.
#
# Run with:  mojo run apps/demo_mopt.mojo

from std.testing import assert_true

from mojo_core import close_to

from mopt import Graph
from mopt import LpBuilder
from mopt import assign
from mopt import brute_force
from mopt import check_complementary_slackness
from mopt import dual_value
from mopt import dijkstra
from mopt import is_valid
from mopt import minimum_spanning_tree
from mopt import shortest_path
from mopt import solve
from mopt import total_cost


def show_linear_program() raises:
    print("== linear programming ==")
    print("  minimise -3x - 2y")
    print("  s.t. x + y <= 4")
    print("       x + 3y <= 6")
    print("       x, y >= 0")

    var r = solve([-3.0, -2.0], [[1.0, 1.0], [1.0, 3.0]], [4.0, 6.0])
    print("  status   ", r.status)
    print("  pivots   ", r.pivots)
    print("  x        ", r.values[0])
    print("  y        ", r.values[1])
    print("  objective", r.objective)

    # Both constraints are tight at the optimum, which is the graphical
    # condition for a vertex solution.
    assert_true(close_to(r.values[0] + r.values[1], 4.0, atol=1e-9, rtol=0.0))
    assert_true(close_to(r.values[0] + 3.0 * r.values[1], 6.0, atol=1e-9, rtol=0.0))
    print("  -> both constraints tight: a vertex solution")
    print()


def show_the_builder():
    print("== the same problem via LpBuilder ==")
    var b = LpBuilder(2)
    _ = b.minimize([-3.0, -2.0])
    _ = b.add_le([1.0, 1.0], 4.0)
    _ = b.add_le([1.0, 3.0], 6.0)
    var r = b.solve()
    print("  objective", r.objective)
    assert_true(r.is_optimal)

    # The builder exists for the rewrites. An equality is added as both of
    # its directions, so `x + y == 3` becomes two rows.
    var e = LpBuilder(2)
    _ = e.minimize([1.0, 0.0])
    _ = e.add_eq([1.0, 1.0], 3.0)
    var re = e.solve()
    print("  min x s.t. x + y == 3  ->  x =", re.values[0], " y =", re.values[1])
    assert_true(close_to(re.values[0], 0.0, atol=1e-9, rtol=0.0))
    assert_true(close_to(re.values[1], 3.0, atol=1e-9, rtol=0.0))
    print()


def show_assignment() raises:
    print("== assignment (Hungarian) ==")
    var cost = [
        [9.0, 2.0, 7.0, 8.0],
        [6.0, 4.0, 3.0, 7.0],
        [5.0, 8.0, 1.0, 8.0],
        [7.0, 6.0, 9.0, 4.0],
    ]
    for i in range(4):
        print("  ", cost[i])

    var a = assign(cost)
    print("  assignment", a)
    print("  cost      ", total_cost(cost, a))
    print("  optimum   ", brute_force(cost))

    assert_true(is_valid(cost, a))
    assert_true(close_to(total_cost(cost, a), brute_force(cost), atol=1e-9, rtol=0.0))

    # Recover the dual prices the algorithm used and verify the certificate.
    # Optimality is not "the algorithm stopped"; it is "a feasible dual
    # solution of equal value exists". `solve_with_duals` is the honest way
    # to get at that, so it is worth showing alongside the answer.
    var dual = solve_with_duals(cost)
    print("  dual obj  ", dual_value(cost, dual[0], dual[1]))
    print("  cert ok   ", check_complementary_slackness(cost, a, dual[0], dual[1]))
    assert_true(close_to(dual_value(cost, dual[0], dual[1]),
                         total_cost(cost, a), atol=1e-6, rtol=0.0))

    # The optimum is 2 + 6 + 1 + 4 = 13, against 18 for the diagonal. Note
    # it is *not* the row-by-row greedy choice: rows 0 and 1 each want the
    # other's column, and letting them swap is what beats their independent
    # bests. Greedy fails here because the two rows are not independent.
    assert_true(close_to(total_cost(cost, a), 13.0, atol=1e-9, rtol=0.0))
    print("  -> diagonal would cost 18; greedy row-by-row gives 14")
    print()


def show_network() raises:
    print("== shortest path ==")
    #        2
    #     0 ----- 3
    #     |      / |
    #     1     /  |
    #      \  4    |
    #       \/     |
    #        5 --- 6
    var g = Graph(7)
    _ = g.add_edge(0, 3, 2.0)
    _ = g.add_edge(0, 1, 5.0)
    _ = g.add_edge(1, 3, 5.0)
    _ = g.add_edge(3, 6, 10.0)
    _ = g.add_edge(1, 5, 4.0)
    _ = g.add_edge(5, 6, 3.0)
    _ = g.add_edge(5, 4, 7.0)

    var d = dijkstra(g, 0)
    print("  distances from 0:")
    for i in range(7):
        # Vertex 2 is isolated, so its distance stays at the unreachable
        # sentinel. That is a number, not an error: "no path" is an answer a
        # caller wants to branch on.
        print("    v", i, " = ", d[i])

    # 0-3-6 costs 12, but 0-1-5-6 costs 5 + 4 + 3 = 12 too. The tie is
    # resolved by whichever the settle order reaches first; the *distance*
    # is 12 either way, and that is the part with a unique answer.
    assert_true(close_to(d[3], 2.0))
    assert_true(close_to(d[5], 9.0))
    assert_true(close_to(d[6], 12.0))

    var p = shortest_path(g, 0, 6)
    print("  a shortest path 0 -> 6:", p)
    assert_true(p[0] == 0 and p[len(p) - 1] == 6)
    print()


def show_spanning_tree() raises:
    print("== minimum spanning tree ==")
    var g = Graph(5)
    _ = g.add_edge(0, 1, 2.0)
    _ = g.add_edge(1, 2, 3.0)
    _ = g.add_edge(2, 3, 1.0)
    _ = g.add_edge(3, 4, 4.0)
    _ = g.add_edge(0, 4, 9.0)
    _ = g.add_edge(1, 4, 7.0)

    var t = minimum_spanning_tree(g)
    print("  edges      ", t.edges)
    print("  count      ", t.edge_count())
    print("  total      ", t.total_weight)
    print("  connected  ", t.connected)

    # 2 + 3 + 1 + 4 = 10, and the expensive 9.0 and 7.0 chords are both
    # skipped. Four edges on five vertices is exactly a tree.
    assert_true(t.edge_count() == 4)
    assert_true(close_to(t.total_weight, 10.0))
    print()


def main() raises:
    show_linear_program()
    show_the_builder()
    show_assignment()
    show_network()
    show_spanning_tree()
    print("mopt demo complete")