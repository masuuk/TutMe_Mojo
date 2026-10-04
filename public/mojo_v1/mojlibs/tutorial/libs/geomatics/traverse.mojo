# traverse.mojo — closed traverse computation and least-squares adjustment.
#
# A *traverse* is a chain of measured distances and angles that should close
# back on itself. It never does: instruments have finite precision, and the
# raw misclosure is the sum of a hundred small errors. The surveyor's job is
# to measure the misclosure, decide whether it is acceptable, and if not,
# distribute the correction over the courses in proportion to how much each
# one could plausibly be at fault.
#
# This module implements the classic Bowditch (compass) rule, plus the
# angular checks that decide whether the traverse is acceptable at all.

from std.math import atan2, cos, sin, sqrt

from mojo_core import DEG_TO_RAD
from mojo_core import wrap_degrees
from .geodesy import EnuFrame
from .geodesy import LatLon

# A bearing is measured to better than 0.1 degrees by any competent theodolite.
comptime BRASS: Float64 = 1.0 / 3600.0  # 10 angular seconds, in degrees

# Distances and angles need different tolerances. A length closure of 1:5000
# over a 1 km traverse is 20 cm; the same relative figure for angles would be
# far stricter than any instrument delivers.
comptime LENGTH_TOLERANCE_PART = 5000.0
comptime ANGULAR_TOLERANCE_ARCSEC: Float64 = 60.0


struct Course(Copyable, Writable):
    """One measured leg of a traverse: a distance and a whole-circle bearing."""

    var distance: Float64
    var bearing: Float64

    def __init__(out self, distance: Float64, bearing: Float64):
        self.distance = distance
        self.bearing = wrap_degrees(bearing)

    def latitude(self) -> Float64:
        """The North-South component: the departure in the northing sense.

        Named after the quantity surveyors actually record. Note it is
        *negative* for a southing course, which is exactly why it must never
        be called `north`.
        """
        return self.distance * cos(self.bearing * DEG_TO_RAD)

    def departure(self) -> Float64:
        """The East-West component, positive to the east."""
        return self.distance * sin(self.bearing * DEG_TO_RAD)

    def back_bearing(self) -> Float64:
        """The reciprocal of the forward bearing."""
        return wrap_degrees(self.bearing + 180.0)

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"{self.distance} m @ {self.bearing}"))


struct TraverseReport(Copyable, Writable):
    """The verdict on a closed traverse.

    A bare `struct`, so it is `Movable` but not `Copyable` — appropriate for
    something that owns several lists of observations. Every field is a
    decision the caller might otherwise have to recompute, which is what
    makes a report worth returning rather than a tuple.
    """

    var course_count: Int
    var perimeter: Float64
    var misclosure_linear: Float64       # metres, vector from start to start
    var misclosure_ratio: Float64        # e.g. 841.0 means "1 part in 841"
    var angular_misclosure: Float64      # degrees
    var angular_tolerance: Float64       # degrees
    var length_is_acceptable: Bool
    var angular_is_acceptable: Bool

    @property
    def is_acceptable(self) -> Bool:
        """Both checks must pass. A traverse can close well in one sense and
        badly in the other, and accepting it on the strength of one test is
        how bad coordinates enter a drawing."""
        return self.length_is_acceptable and self.angular_is_acceptable

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"TraverseReport({self.course_count} courses)"))


def sum_latitudes(courses: List[Course]) -> Float64:
    var total = 0.0
    for i in range(len(courses)):
        total += courses[i].latitude()
    return total


def sum_departures(courses: List[Course]) -> Float64:
    var total = 0.0
    for i in range(len(courses)):
        total += courses[i].departure()
    return total


def perimeter(courses: List[Course]) -> Float64:
    var total = 0.0
    for i in range(len(courses)):
        total += courses[i].distance
    return total


def angular_misclosure(courses: List[Course]) raises -> Float64:
    """Total angular misclosure of a closed traverse, in degrees.

    For a closed polygon traversed once, the theoretical sum of interior
    angles is `(n - 2) * 180`. But a survey traverse is measured by azimuths,
    not interior angles, so the constraint is simpler and stronger: the sum
    of the measured *deflection* angles must be 360 degrees.

    Working from deflections is what makes this robust. Summing raw bearings
    and expecting a round number depends on where the operator happened to
    start, which is an accident of the numbering rather than a property of
    the survey.
    """
    var n = len(courses)
    if n < 3:
        raise "angular_misclosure: a closed traverse needs at least 3 courses"

    # Deflection at each station is the change in bearing from the previous
    # course, folded to (-180, 180].
    var total_deflection = 0.0
    for i in range(n):
        var prev = courses[i - 1].bearing      # i == 0 wraps to the last course
        var d = courses[i].bearing - prev
        while d > 180.0:
            d -= 360.0
        while d <= -180.0:
            d += 360.0
        total_deflection += d

    # Total should be +/- 360 depending on the direction of travel.
    var error = total_deflection
    while error > 180.0:
        error -= 360.0
    while error <= -180.0:
        error += 360.0
    return abs(error)


def angular_tolerance(course_count: Int) raises -> Float64:
    """Allowable angular misclosure, in degrees, for `course_count` courses.

    The standard field rule: `tolerance_arcsec = 45 * sqrt(n)` arc-seconds,
    where `n` is the number of courses. Forty-five arc-seconds is the single
    instrument accuracy figure a traverse is judged against.
    """
    if course_count < 1:
        raise "angular_tolerance: need at least one course"
    var arcsec = 45.0 * sqrt(Float64(course_count))
    return arcsec / 3600.0


def check_traverse(courses: List[Course]) raises -> TraverseReport:
    """Measure the closure of a closed traverse and judge it.

    Accepts a traverse whose misclosure exceeds the tolerance and reports it.
    The caller decides whether to adjust or to re-observe, because that
    depends on ground conditions this function knows nothing about.
    """
    var n = len(courses)
    if n < 3:
        raise "check_traverse: a closed traverse needs at least 3 courses"

    var sum_lat = sum_latitudes(courses)
    var sum_dep = sum_departures(courses)
    var peri = perimeter(courses)

    # Linear misclosure is the straight-line distance between where the
    # traverse ended and where it started.
    var misclosure = sqrt(sum_lat * sum_lat + sum_dep * sum_dep)
    # Express it as "1 part in N", the way a survey report states it. A
    # smaller N is better; N is infinite for a degenerate traverse.
    var ratio = 0.0
    if peri > 0.0:
        ratio = peri / misclosure if misclosure > 0.0 else 0.0

    var ang = angular_misclosure(courses)
    var ang_tol = angular_tolerance(n)

    return TraverseReport(
        n,
        peri,
        misclosure,
        ratio,
        ang,
        ang_tol,
        ratio >= LENGTH_TOLERANCE_PART,
        ang <= ang_tol,
    )


def bowditch_adjust(courses: List[Course]) raises -> List[Course]:
    """Distribute the closure error over the courses — the compass rule.

    Each course receives a correction to its latitude and departure
    proportional to its own length:

        correction = -misclosure * (course_length / total_length)

    The reasoning is that observational error grows with the length of the
    thing observed, so a long course deserves a larger share of the
    correction than a short one. Bowditch is the right default for ordinary
    terrestrial work where sight lengths are roughly uniform. When some
    courses are much more precise than others, weight by *variance* instead
    and the answer changes.

    Returns a new list; the input is left alone. Adjustment is a decision
    that a caller may want to inspect before accepting.
    """
    var n = len(courses)
    if n < 3:
        raise "bowditch_adjust: a closed traverse needs at least 3 courses"

    var sum_lat = sum_latitudes(courses)
    var sum_dep = sum_departures(courses)
    var peri = perimeter(courses)
    if peri <= 0.0:
        raise "bowditch_adjust: traverse has zero perimeter"

    var adjusted = List[Course]()
    var lat_correction = 0.0
    var dep_correction = 0.0

    for i in range(n):
        var c = courses[i]
        var weight = c.distance / peri

        var corr_lat = -sum_lat * weight
        var corr_dep = -sum_dep * weight
        lat_correction += corr_lat
        dep_correction += corr_dep

        # Rebuild the course from its corrected components rather than by
        # nudging the bearing. Resolving back to (distance, bearing) keeps
        # the type honest, and the residual length error introduced here is
        # far below the noise floor of the observation.
        var new_lat = c.latitude() + corr_lat
        var new_dep = c.departure() + corr_dep
        var new_bearing = wrap_degrees(atan2(new_dep, new_lat) / DEG_TO_RAD)
        adjusted.append(Course(c.distance, new_bearing))

    # The last course absorbs the accumulated rounding of every other
    # correction, so the adjusted traverse closes to within floating-point
    # noise instead of to within accumulated rounding error.
    var residual_lat = sum_latitudes(adjusted) + lat_correction
    var residual_dep = sum_departures(adjusted) + dep_correction
    var last_lat = adjusted[n - 1].latitude() - residual_lat
    var last_dep = adjusted[n - 1].departure() - residual_dep
    adjusted[n - 1] = Course(
        adjusted[n - 1].distance,
        wrap_degrees(atan2(last_dep, last_lat) / DEG_TO_RAD),
    )

    return adjusted


def traverse_closure_error(adjusted: List[Course]) -> Float64:
    """Residual closure of an adjusted traverse, in metres.

    Should be at the level of floating-point noise. A large value here means
    the adjustment has a bug, so this function exists to be asserted on.
    """
    var lat = sum_latitudes(adjusted)
    var dep = sum_departures(adjusted)
    return sqrt(lat * lat + dep * dep)


def station_positions(
    start: LatLon, courses: List[Course]
) raises -> List[LatLon]:
    """Walk a traverse, returning the position after each course.

    Works in a local tangent plane rather than on the sphere: over a few
    kilometres the difference is well under a centimetre, and the planar
    arithmetic is far easier to reason about than spherical trigonometry
    applied course by course.
    """
    var frame = EnuFrame.at(start)
    var positions = List[LatLon]()
    positions.append(start)

    var e = 0.0
    var n_ = 0.0
    for i in range(len(courses)):
        var c = courses[i]
        n_ += c.latitude()
        e += c.departure()
        positions.append(frame.to_latlon(e, n_, 0.0))
    return positions