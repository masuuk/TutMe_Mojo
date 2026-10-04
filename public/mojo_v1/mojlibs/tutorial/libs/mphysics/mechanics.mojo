# mechanics.mojo — classical mechanics helpers used by the physics package.

const PI = 3.141592653589793


def force(mass: Float64, acceleration: Float64) -> Float64:
    return mass * acceleration


def kinetic_energy(mass: Float64, speed: Float64) -> Float64:
    return 0.5 * mass * speed * speed


def momentum(mass: Float64, speed: Float64) -> Float64:
    return mass * speed


def work(force_value: Float64, displacement: Float64) -> Float64:
    return force_value * displacement


def orbital_speed(radius_m: Float64, mu: Float64) -> Float64:
    return (mu / radius_m) ** 0.5
