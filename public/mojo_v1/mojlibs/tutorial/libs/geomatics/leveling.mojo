# leveling.mojo — differential levelling and its misclosure.
#
# Levelling is the simplest survey there is, and the easiest to get subtly
# wrong. You measure a backsight and a foresight at each setup, and the
# height change is the difference. Done properly over a closed loop, the
# total height change must be exactly zero. Everything interesting is in
# deciding whether the observed error is acceptable and how to distribute it.
#
# Rise-and-fall (the method of differences) is used here rather than the
# simpler height-of-instrument method, because it requires only arithmetic
# on readings and never asks the surveyor to interpolate a reading at an
# exact point on the staff.

from std.math import sqrt

# A good automatic level reads to about 3 mm over a double setup.
comptime READ_RESOLUTION_MM: Float64 = 3.0

# The published allowance: the square root of the distance in kilometres,
# in millimetres. So 4 mm over 1 km, 12 mm over 9 km.
comptime LEVEL_TOLERANCE_MM_PER_SQRT_KM: Float64 = 4.0


struct LevelStation(Copyable, Writable):
    """One instrument setup: a backsight reading and the foresight that follows."""

    var backsight: Float64   # staff reading when the instrument was set up
    var foresight: Float64  # staff reading at the next change point

    def __init__(out self, backsight: Float64, foresight: Float64):
        self.backsight = backsight
        self.foresight = foresight

    def rise_fall(self) -> Float64:
        """The height change from this setup.

        Positive means ground rising along the line of travel, negative
        falling. The *difference* of the two readings is all that matters,
        and which reading goes first is a bookkeeping convention that varies
        between textbooks — so this function fixes one and states it in the
        return value's sign.
        """
        return self.backsight - self.foresight

    def distance(self) -> Float64:
        """Sight length implied by the staff intercept.

        Multiplying the intercept by the staff's graduation (100 mm per
        interval, conventionally taken as 100 m per interval) gives the
        distance in metres.
        """
        var intercept = self.foresight - self.backsight
        if intercept < 0.0:
            intercept = -intercept
        return intercept * 100.0

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"BS={self.backsight} FS={self.foresight}"))


struct LevelRun(Copyable, Writable):
    """The computed result of a levelling run."""

    var setup_count: Int
    var length_m: Float64
    var misclosure_mm: Float64
    var tolerance_mm: Float64
    var total_rise_m: Float64
    var is_acceptable: Bool
    var misclosure_per_setup_mm: Float64

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"LevelRun({self.setup_count} setups)"))


def total_rise(stations: List[LevelStation]) -> Float64:
    """Sum of every height change along the run, in metres.

    For a closed loop this must come out at (near) zero. That is the whole
    test, and it is worth having as a named function so the intent is
    obvious at the call site.
    """
    var total = 0.0
    for i in range(len(stations)):
        total += stations[i].rise_fall()
    return total


def run_length_m(stations: List[LevelStation]) -> Float64:
    var total = 0.0
    for i in range(len(stations)):
        total += stations[i].distance()
    return total


def allowable_misclosure_mm(length_m: Float64) -> Float64:
    """Allowable misclosure for a run of `length_m`, in millimetres.

    The field rule is `4 mm * sqrt(distance in km)`. Expressing the tolerance
    as a function of length rather than a fixed constant is the whole point:
    a 10 km run is allowed 12.6 mm, a 1 km run only 4 mm. A fixed tolerance
    makes short runs pass trivially and long runs fail unfairly.
    """
    var km = length_m / 1000.0
    if km <= 0.0:
        return 0.0
    return LEVEL_TOLERANCE_MM_PER_SQRT_KM * sqrt(km)


def check_run(stations: List[LevelStation]) raises -> LevelRun:
    """Close a levelling run and judge the result.

    Raises on an empty list, because the misclosure of no observations is
    not zero — it is unmeasured, and reporting it as zero would hide a
    completely unlevelled line.
    """
    var n = len(stations)
    if n == 0:
        raise "check_run: no levelling setups supplied"

    var rise = total_rise(stations)
    var length = run_length_m(stations)
    var misclosure_mm = abs(rise) * 1000.0
    var tol = allowable_misclosure_mm(length)

    return LevelRun(
        n,
        length,
        misclosure_mm,
        tol,
        rise,
        misclosure_mm <= tol,
        misclosure_mm / Float64(n),
    )


def distribute_correction(stations: List[LevelStation]) raises -> List[Float64]:
    """The height adjustment at every setup, in metres.

    The total misclosure is removed in proportion to the number of setups,
    each of which contributes roughly equal error. The adjustment at setup
    `i` is the negative of the misclosure accumulated up to and including
    that setup, which guarantees the run closes to within floating-point
    noise at the far end.

    Returns one correction per setup, in order.
    """
    var n = len(stations)
    if n == 0:
        raise "distribute_correction: no levelling setups supplied"

    var misclosure = total_rise(stations)
    var corrections = List[Float64]()
    var running = 0.0
    for i in range(n):
        running += stations[i].rise_fall()
        # Spread the total misclosure evenly across setups, then remove the
        # part accumulated so far. Equivalent to -(running - (i+1)*avg).
        var share = misclosure * Float64(i + 1) / Float64(n)
        corrections.append(-(running - share))
    return corrections


def reduced_levels(
    start_height: Float64, stations: List[LevelStation]
) raises -> List[Float64]:
    """Height at the end of every setup, starting from `start_height`.

    Applies the rise-and-fall correction at each step so the final value is
    the adjusted height of the closing point.
    """
    var n = len(stations)
    if n == 0:
        raise "reduced_levels: no levelling setups supplied"

    var corrections = distribute_correction(stations)
    var heights = List[Float64]()
    var h = start_height
    for i in range(n):
        h += stations[i].rise_fall() + corrections[i]
        heights.append(h)
    return heights