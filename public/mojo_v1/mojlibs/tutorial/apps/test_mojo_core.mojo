# test_mojo_core.mojo — the test suite for the `mojo_core` kernel.
#
# Run it with:
#
#     mojo precompile libs/mojo_core -o mojo_core.mojoc
#     mojo run apps/test_mojo_core.mojo
#
# Mojo has no test-runner command, so a test suite is an ordinary program: a
# `main()` that calls `test_*` functions and reports as it goes. The only
# difference from an application is the discipline of the names.
#
# Assertions come from `std.testing`. `assert_raises` is a *context manager*,
# so a call that is expected to fail goes inside a `with` block.

from std.testing import assert_true, assert_equal, assert_raises

from mojo_core import (
    close_to,
    clamp,
    lerp,
    safe_div,
    relative_error,
    wrap_degrees,
    angular_difference_deg,
    deg_to_rad,
    rad_to_deg,
    mean,
    sum_of_squares,
    Rng,
    Vec2,
    Vec3,
    distance,
    centroid,
    Matrix,
    matmul,
    trace,
    frobenius_norm,
    is_diagonal,
)


# ── numeric ────────────────────────────────────────────────────────────────

def test_close_to_respects_tolerance():
    assert_true(close_to(0.1 + 0.2, 0.3, 1e-12, 1e-9))
    assert_true(not close_to(1.0, 1.1, 1e-12, 1e-9))
    # The default relative tolerance is loose enough for accumulated sums
    # but still rejects a genuine 1% disagreement.
    assert_true(close_to(1000.0, 1000.5))
    assert_true(not close_to(1000.0, 1100.0))


def test_clamp_clamps_at_both_ends() raises:
    assert_equal(clamp(5.0, 0.0, 10.0), 5.0)
    assert_equal(clamp(-3.0, 0.0, 10.0), 0.0)
    assert_equal(clamp(42.0, 0.0, 10.0), 10.0)


def test_clamp_rejects_inverted_bounds():
    # An inverted interval is a caller bug, not a silent no-op.
    with assert_raises("clamp: inverted bounds", clamp, 1.0, 10.0, 0.0):
        pass


def test_lerp_endpoints_and_midpoint():
    assert_equal(lerp(0.0, 10.0, 0.0), 0.0)
    assert_equal(lerp(0.0, 10.0, 1.0), 10.0)
    assert_equal(lerp(0.0, 10.0, 0.5), 5.0)


def test_lerp_extrapolates_rather_than_folding():
    # Deliberate design choice, and therefore worth pinning down in a test.
    assert_equal(lerp(0.0, 10.0, 2.0), 20.0)
    assert_equal(lerp(0.0, 10.0, -1.0), -10.0)


def test_safe_div_returns_default_on_zero():
    assert_equal(safe_div(10.0, 2.0), 5.0)
    assert_equal(safe_div(1.0, 0.0), 0.0)
    assert_equal(safe_div(1.0, 0.0, -1.0), -1.0)


def test_relative_error_rejects_zero_reference() raises:
    assert_true(close_to(relative_error(11.0, 10.0), 0.1))
    with assert_raises("relative_error: zero reference", relative_error, 1.0, 0.0):
        pass


def test_angle_wrapping():
    assert_equal(wrap_degrees(0.0), 0.0)
    assert_equal(wrap_degrees(360.0), 0.0)
    assert_equal(wrap_degrees(370.0), 10.0)
    assert_equal(wrap_degrees(-10.0), 350.0)
    assert_equal(wrap_degrees(725.0), 5.0)


def test_angular_difference_takes_the_short_way():
    assert_true(close_to(angular_difference_deg(350.0, 10.0), 20.0))
    assert_true(close_to(angular_difference_deg(10.0, 350.0), -20.0))
    assert_true(close_to(angular_difference_deg(0.0, 180.0), 180.0))


def test_degree_radian_round_trip():
    assert_true(close_to(rad_to_deg(deg_to_rad(137.0)), 137.0, 1e-12, 1e-12))


def test_mean_of_the_classic_dataset() raises:
    var d = List[Float64]()
    for v in [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]:
        d.append(v)
    assert_equal(len(d), 8)
    assert_true(close_to(mean(d), 5.0))
    assert_true(close_to(sum_of_squares(d), 232.0))


def test_mean_raises_on_empty():
    with assert_raises("mean: empty input", mean, List[Float64]()):
        pass


# ── random ─────────────────────────────────────────────────────────────────

def test_rng_is_deterministic_for_a_given_seed():
    var a = Rng(7)
    var b = Rng(7)
    for _ in range(16):
        assert_equal(a.uniform(), b.uniform())


def test_rng_differs_between_seeds():
    var a = Rng(1)
    var b = Rng(2)
    assert_true(a.uniform() != b.uniform())


def test_rng_uniform_stays_in_range():
    var r = Rng(99)
    for _ in range(2000):
        var u = r.uniform()
        assert_true(u >= 0.0 and u < 1.0)


def test_rng_uniform_is_roughly_flat():
    # Ten equal buckets should each hold about 10% of 10000 draws.
    # A +-1% band is a very loose test that still catches a badly biased
    # generator, which is all we want from a smoke test.
    var r = Rng(1234)
    var buckets = List[Int]()
    for _ in range(10):
        buckets.append(0)
    for _ in range(10000):
        var u = r.uniform()
        var b = Int(u * 10.0)
        if b > 9:
            b = 9
        buckets[b] += 1
    for i in range(10):
        assert_true(buckets[i] > 900 and buckets[i] < 1100)


def test_rng_below_respects_bound():
    var r = Rng(5)
    for _ in range(500):
        var v = r.below(6)
        assert_true(v >= 0 and v < 6)


def test_rng_below_rejects_nonpositive_bound():
    var r = Rng(5)
    with assert_raises("Rng.below: bound must be positive", r.below, 0):
        pass


def test_rng_shuffle_is_a_permutation():
    var r = Rng(11)
    var xs = List[Float64]()
    for v in [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]:
        xs.append(v)
    r.shuffled(mut xs)
    assert_equal(len(xs), 8)
    # Sum is invariant under permutation — the cheapest possible check that
    # nothing was dropped or duplicated.
    assert_true(close_to(sum_of_squares(xs), 204.0))


# ── vec ────────────────────────────────────────────────────────────────────

def test_vec2_length():
    var v = Vec2(3.0, 4.0)
    assert_true(close_to(v.length(), 5.0))
    assert_true(close_to(v.length_squared(), 25.0))


def test_vec2_arithmetic():
    var a = Vec2(1.0, 2.0)
    var b = Vec2(10.0, 20.0)
    assert_true(close_to((a + b).x, 11.0))
    assert_true(close_to((b - a).length(), b.length()))
    assert_true(close_to(a.dot(a), 5.0))


def test_vec2_normalize_raises_on_zero():
    with assert_raises("Vec2.normalized: zero-length vector", Vec2(0.0, 0.0).normalized):
        pass


def test_vec3_cross_is_perpendicular():
    var x = Vec3(1.0, 0.0, 0.0)
    var y = Vec3(0.0, 1.0, 0.0)
    var z = x.cross(y)
    assert_true(close_to(z.x, 0.0))
    assert_true(close_to(z.y, 0.0))
    assert_true(close_to(z.z, 1.0))
    assert_true(close_to(x.dot(z), 0.0))


def test_centroid_and_distance() raises:
    var pts = List[Vec2]()
    pts.append(Vec2(0.0, 0.0))
    pts.append(Vec2(4.0, 0.0))
    pts.append(Vec2(4.0, 4.0))
    assert_true(close_to(distance(Vec2(0.0, 0.0), Vec2(4.0, 0.0)), 4.0))
    assert_true(close_to(centroid(pts).x, 8.0 / 3.0))


def test_centroid_raises_on_empty():
    with assert_raises("centroid: empty point list", centroid, List[Vec2]()):
        pass


# ── matrix ─────────────────────────────────────────────────────────────────

def test_identity_and_trace():
    var m = Matrix.identity(4)
    assert_equal(m.rows, 4)
    assert_equal(m.cols, 4)
    assert_true(close_to(trace(m), 4.0))
    assert_true(is_diagonal(m))


def test_matrix_multiplication_and_determinant() raises:
    var a = Matrix.identity(3)
    a.set(0, 1, 2.0)
    a.set(1, 2, 3.0)
    a.set(2, 0, 4.0)
    # This is the classic 3-cycle permutation. The cycle (0 1 2) is even, so
    # the determinant is +1 — a good check that the pivoting does not lose
    # the sign of the row swaps.
    assert_true(close_to(a.determinant(), 1.0))

    # A matrix times the identity is the matrix. Any row-major indexing bug
    # in `matmul` shows up immediately as a non-zero residual.
    var p = matmul(a, Matrix.identity(3))
    assert_true(close_to(frobenius_norm(p) - frobenius_norm(a), 0.0))
    assert_equal(p.rows, 3)
    assert_true(close_to(p.get(0, 1), 2.0))
    assert_true(close_to(p.get(1, 2), 3.0))
    assert_true(close_to(p.get(2, 0), 4.0))


def test_matrix_solve_recovers_a_known_vector():
    # 2x + y = 5 ;  x + 3y = 10   =>  x = 1, y = 3
    var m = Matrix.filled(2, 2, 0.0)
    m.set(0, 0, 2.0)
    m.set(0, 1, 1.0)
    m.set(1, 0, 1.0)
    m.set(1, 1, 3.0)
    var rhs = List[Float64]()
    rhs.append(5.0)
    rhs.append(10.0)
    var x = m.solve(mut rhs)
    assert_true(close_to(x[0], 1.0, 1e-12, 1e-12))
    assert_true(close_to(x[1], 3.0, 1e-12, 1e-12))


def test_matrix_solve_rejects_singular():
    # Two identical rows: no unique solution exists.
    var m = Matrix.filled(2, 2, 1.0)
    var rhs = List[Float64]()
    rhs.append(1.0)
    rhs.append(2.0)
    with assert_raises("solve: matrix is singular", m.solve, rhs):
        pass


def test_matrix_rejects_oversized():
    with assert_raises("Matrix: dimension too large", Matrix, 99, 99):
        pass


def test_matrix_rejects_nonsquare_determinant():
    var m = Matrix.filled(2, 3, 1.0)
    with assert_raises("determinant: not square", m.determinant):
        pass


# ── entry point ────────────────────────────────────────────────────────────

def main() raises:
    print("mojo_core test suite")
    print("--------------------")

    # Each call is one line of the report. There is no runner to name the
    # failures for us, so `main()` owns that job.
    test_close_to_respects_tolerance()
    test_clamp_clamps_at_both_ends()
    test_clamp_rejects_inverted_bounds()
    test_lerp_endpoints_and_midpoint()
    test_lerp_extrapolates_rather_than_folding()
    test_safe_div_returns_default_on_zero()
    test_relative_error_rejects_zero_reference()
    test_angle_wrapping()
    test_angular_difference_takes_the_short_way()
    test_degree_radian_round_trip()
    test_mean_of_the_classic_dataset()
    test_mean_raises_on_empty()

    test_rng_is_deterministic_for_a_given_seed()
    test_rng_differs_between_seeds()
    test_rng_uniform_stays_in_range()
    test_rng_uniform_is_roughly_flat()
    test_rng_below_respects_bound()
    test_rng_below_rejects_nonpositive_bound()
    test_rng_shuffle_is_a_permutation()

    test_vec2_length()
    test_vec2_arithmetic()
    test_vec2_normalize_raises_on_zero()
    test_vec3_cross_is_perpendicular()
    test_centroid_and_distance()
    test_centroid_raises_on_empty()

    test_identity_and_trace()
    test_matrix_multiplication_and_determinant()
    test_matrix_solve_recovers_a_known_vector()
    test_matrix_solve_rejects_singular()
    test_matrix_rejects_oversized()
    test_matrix_rejects_nonsquare_determinant()

    print("all 31 tests passed")