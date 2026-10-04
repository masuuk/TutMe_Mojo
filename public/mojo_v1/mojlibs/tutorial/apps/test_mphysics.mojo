# test_mphysics.mojo — small checks for the `mphysics` package.
# Run with:  mojo run apps/test_mphysics.mojo

from std.testing import assert_true
from std.testing import assert_raises

from mphysics import angular_frequency
from mphysics import cycle_count
from mphysics import force
from mphysics import kinetic_energy
from mphysics import momentum
from mphysics import orbital_speed
from mphysics import phase_from_cycles


def test_mechanics() raises:
    assert_true(force(2.0, 3.0) == 6.0)
    assert_true(kinetic_energy(2.0, 5.0) == 25.0)
    assert_true(momentum(2.0, 5.0) == 10.0)
    assert_true(orbital_speed(7000000.0, 3.986e14) > 0.0)


def test_oscillation() raises:
    assert_true(angular_frequency(2.0) > 0.0)
    assert_true(phase_from_cycles(0.25) > 0.0)
    assert_true(cycle_count(2.0, 4.0) == 2.0)
    with assert_raises(Error):
        _ = angular_frequency(0.0)


def main() raises:
    test_mechanics()
    test_oscillation()
    print("mphysics: all tests passed")
