# demo_mojo_core.mojo — a tour of the shared kernel.
#
#     mojo precompile libs/mojo_core -o mojo_core.mojoc
#     mojo run apps/demo_mojo_core.mojo
#
# Everything printed here is deterministic. The generator is seeded, the
# matrix is fixed, and no clock or environment value is consulted — so the
# output in the tutorial is something you can reproduce and check by hand.

from mojo_core import (
    clamp,
    lerp,
    wrap_degrees,
    angular_difference_deg,
    close_to,
    Rng,
    Vec2,
    Vec3,
    centroid,
    distance,
    Matrix,
    matmul,
    trace,
    frobenius_norm,
)


def section(title: String):
    """Print a blank line and a titled rule.

    Built by appending in a loop rather than multiplying a string by a count:
    `String * Int` is not part of the surface this tutorial relies on, and a
    helper that could fail to compile is not worth the convenience.
    """
    print("")
    print(String("-- ") + title)
    var rule = String("")
    for _ in range(58):
        rule += "-"
    print(rule)


def demo_tolerances() raises:
    section("tolerance and clamping")
    # `==` on floats is a trap; `close_to` is the library's answer.
    print("0.1 + 0.2 == 0.3           :", 0.1 + 0.2 == 0.3)
    print("close_to(0.1+0.2, 0.3)    :", close_to(0.1 + 0.2, 0.3))
    print("clamp(-3.0, 0.0, 10.0)     :", clamp(-3.0, 0.0, 10.0))
    print("clamp(42.0, 0.0, 10.0)     :", clamp(42.0, 0.0, 10.0))
    print("lerp(0, 10, 0.5)           :", lerp(0.0, 10.0, 0.5))


def demo_angles():
    section("angles")
    # Survey bearings routinely leave [0, 360) during arithmetic. Folding them
    # back at the boundary is what makes equality checks meaningful.
    print("wrap_degrees(725.0)        :", wrap_degrees(725.0))
    print("wrap_degrees(-10.0)        :", wrap_degrees(-10.0))
    print("difference 350 -> 10       :", angular_difference_deg(350.0, 10.0))


def demo_vectors() raises:
    section("vectors")
    var a = Vec2(3.0, 4.0)
    var b = Vec2(-1.0, 2.0)
    print("a                         :", a)
    print("b                         :", b)
    print("a + b                     :", a + b)
    print("a - b                     :", a - b)
    print("|a|                       :", a.length())
    print("|a|^2                     :", a.length_squared())
    print("distance(a, b)            :", distance(a, b))

    var x = Vec3(1.0, 0.0, 0.0)
    var y = Vec3(0.0, 1.0, 0.0)
    print("x cross y                 :", x.cross(y))
    print("x dot (x cross y)          :", x.dot(x.cross(y)))

    var pts = List[Vec2]()
    pts.append(Vec2(0.0, 0.0))
    pts.append(Vec2(4.0, 0.0))
    pts.append(Vec2(4.0, 3.0))
    pts.append(Vec2(0.0, 3.0))
    print("centroid of 4 points      :", centroid(pts))


def demo_matrix() raises:
    section("matrices")
    # A 3x3 matrix, entered one row at a time.
    var m = Matrix.filled(3, 3, 0.0)
    m.set(0, 0, 2.0)
    m.set(0, 1, 1.0)
    m.set(0, 2, -1.0)
    m.set(1, 0, -3.0)
    m.set(1, 1, -1.0)
    m.set(1, 2, 2.0)
    m.set(2, 0, -2.0)
    m.set(2, 1, 1.0)
    m.set(2, 2, 2.0)
    print("det(M)                    :", m.determinant())
    print("trace(I3)                 :", trace(Matrix.identity(3)))
    print("frobenius norm of M       :", frobenius_norm(m))
    # Multiplying by the identity is the cheapest sanity check on indexing.
    print("|M @ I - M|_F             :", frobenius_norm(matmul(m, Matrix.identity(3))) - frobenius_norm(m))


def demo_random() raises:
    section("deterministic randomness")
    # Same seed, same stream. This is the property that makes the printed
    # numbers in a tutorial trustworthy.
    var a = Rng(2024)
    var b = Rng(2024)
    var identical = True
    for _ in range(8):
        if a.uniform() != b.uniform():
            identical = False
    print("same seed -> same stream  :", identical)

    var r = Rng(7)
    print("first 6 uniforms          :", r.uniform(), r.uniform(), r.uniform())
    print("                              ", r.uniform(), r.uniform(), r.uniform())

    var s = Rng(3)
    print("normal(0, 1)              :", s.normal(0.0, 1.0))
    print("lognormal(0, 0.5)         :", s.lognormal(0.0, 0.5))
    print("below(6)                  :", s.below(6))

    # Shuffling is in place, so the caller's list is what changes.
    var cards = List[Float64]()
    for v in [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]:
        cards.append(v)
    var t = Rng(99)
    t.shuffled(mut cards)
    print("shuffled [1..8]           :", cards[0], cards[1], cards[2], cards[3],
        cards[4], cards[5], cards[6], cards[7])


def main() raises:
    print("mojo_core 0.1.0 -- shared numeric kernel")
    demo_tolerances()
    demo_angles()
    demo_vectors()
    demo_matrix()
    demo_random()
    print("")
    print("every value above is reproducible: no clock, no OS entropy")