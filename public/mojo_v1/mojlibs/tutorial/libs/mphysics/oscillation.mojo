# oscillation.mojo — periodic motion helpers used by the physics package.

const PI = 3.141592653589793


def angular_frequency(period_s: Float64) raises -> Float64:
    if period_s <= 0.0:
        raise Error("period must be positive")
    return 2.0 * PI / period_s


def frequency_from_period(period_s: Float64) raises -> Float64:
    if period_s <= 0.0:
        raise Error("period must be positive")
    return 1.0 / period_s


def phase_from_cycles(cycles: Float64) -> Float64:
    return 2.0 * PI * cycles


def cycle_count(period_s: Float64, elapsed_s: Float64) raises -> Float64:
    if period_s <= 0.0:
        raise Error("period must be positive")
    return elapsed_s / period_s
