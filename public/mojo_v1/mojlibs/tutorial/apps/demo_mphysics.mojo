# demo_mphysics.mojo — a short demonstration of the physics package.
# Run with:  mojo run apps/demo_mphysics.mojo

from mphysics import angular_frequency
from mphysics import cycle_count
from mphysics import force
from mphysics import kinetic_energy
from mphysics import momentum
from mphysics import orbital_speed
from mphysics import phase_from_cycles


def main() raises:
    print("force =", force(2.0, 3.0))
    print("kinetic energy =", kinetic_energy(2.0, 5.0))
    print("momentum =", momentum(2.0, 5.0))
    print("orbital speed =", orbital_speed(7000000.0, 3.986e14))
    print("angular frequency =", angular_frequency(2.0))
    print("phase =", phase_from_cycles(0.25))
    print("cycles elapsed =", cycle_count(2.0, 5.0))
