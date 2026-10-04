# geodesy.mojo — positions on the ellipsoid, distances, and local frames.
#
# Surveying is coordinate arithmetic with hard physical constraints: angles
# are azimuths from north, distances are metres along the ground, and the
# Earth is not a sphere. This module handles the three things every traverse
# calculation needs before it can do anything else.
#
# Degrees versus radians is the single most common bug source in geospatial
# code, so every function that takes an angle states its unit in the name.

from std.math import asin, atan2, cos, sin, sqrt

from mojo_core import DEG_TO_RAD
from mojo_core import RAD_TO_DEG
from mojo_core import angular_difference_deg
from mojo_core import wrap_degrees

# WGS-84 ellipsoid.
comptime EARTH_A: Float64 = 6378137.0            # semi-major axis, m
comptime EARTH_F: Float64 = 1.0 / 298.257223563  # flattening
comptime EARTH_B: Float64 = EARTH_A * (1.0 - EARTH_F)  # semi-minor axis, m
comptime EARTH_E2: Float64 = EARTH_F * (2.0 - EARTH_F)  # first eccentricity squared

# Mean radius used for the spherical fallback and for quick estimates.
comptime EARTH_R: Float64 = 6371008.8

# Below this many metres two points are treated as the same spot.
comptime COINCIDENT_M: Float64 = 1e-9


struct LatLon(Copyable, Writable):
    """A geodetic position: latitude and longitude in **degrees**, height in metres.

    Degrees, not radians, in the stored form. Every geo library that stores
    radians has a bug report attached to it; degrees are what surveyors,
    GIS software and maps all display, so they are what we keep.
    """

    var lat: Float64
    var lon: Float64
    var height: Float64

    def __init__(out self, lat: Float64, lon: Float64, height: Float64 = 0.0):
        self.lat = lat
        self.lon = lon
        self.height = height

    def __add__(self, other: LatLon) -> LatLon:
        return LatLon(self.lat + other.lat, self.lon + other.lon, self.height + other.height)

    def __sub__(self, other: LatLon) -> LatLon:
        return LatLon(self.lat - other.lat, self.lon - other.lon, self.height - other.height)

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"({self.lat}°, {self.lon}°)"))


# ── normalisation ──────────────────────────────────────────────────────────

def normalize_lon(lon: Float64) -> Float64:
    """Fold a longitude into `[-180, 180]`.

    Longitude wraps at the antimeridian, which is a data-entry hazard as much
    as a mathematical one: 179.9°E and -179.9°E are four kilometres apart.
    """
    var r = wrap_degrees(lon + 180.0) - 180.0
    # `wrap_degrees` maps onto [0, 360); -180 and 180 are the same meridian,
    # and the half-open convention at the top is the conventional one.
    return r


def is_valid_lat(lat: Float64) -> Bool:
    return lat >= -90.0 and lat <= 90.0


def is_valid_lon(lon: Float64) -> Bool:
    return lon >= -180.0 and lon <= 180.0


def validate(p: LatLon) raises -> LatLon:
    """Return `p` if its coordinates are in range, otherwise raise.

    A cheap gate. Longitude is silently normalised first, because an
    out-of-range longitude is nearly always a wrap that was not applied.
    """
    if not is_valid_lat(p.lat):
        raise String(t"latitude {p.lat} outside [-90, 90]")
    var q = LatLon(p.lat, normalize_lon(p.lon), p.height)
    return q


# ── distance ───────────────────────────────────────────────────────────────

def haversine_m(a: LatLon, b: LatLon) raises -> Float64:
    """Great-circle distance in metres on a sphere of radius `EARTH_R`.

    Haversine rather than the law of cosines because the law of cosines
    loses catastrophic precision for short distances — precisely the ones a
    survey instrument produces. Haversine is stable all the way down to
    centimetres.

    Validates both endpoints, as `geodesic_m` does. Two functions with the
    same signature must not disagree about whether an out-of-range longitude
    is an error, because a caller switching between them to compare results
    has no way to know that one of them normalises and the other does not.
    """
    var pa = validate(a)
    var pb = validate(b)

    var phi1 = pa.lat * DEG_TO_RAD
    var phi2 = pb.lat * DEG_TO_RAD
    var dphi = (pb.lat - pa.lat) * DEG_TO_RAD
    var dlambda = (pb.lon - pa.lon) * DEG_TO_RAD

    var sin_dphi = sin(dphi * 0.5)
    var sin_dlambda = sin(dlambda * 0.5)
    var h = sin_dphi * sin_dphi + cos(phi1) * cos(phi2) * sin_dlambda * sin_dlambda
    # Guard against h > 1 from rounding when the two points coincide exactly.
    if h > 1.0:
        h = 1.0
    return 2.0 * EARTH_R * asin(sqrt(h))


def geodesic_m(a: LatLon, b: LatLon) raises -> Float64:
    """Vincenty-style distance on the WGS-84 ellipsoid.

    Accurate to about a millimetre for the distances a terrestrial survey
    actually measures. Falls back to the spherical result for near-antipodal
    pairs, where the iterative method is known not to converge.
    """
    var la = validate(a)
    var lb = validate(b)

    if haversine_m(la, lb) < COINCIDENT_M:
        return 0.0

    var phi1 = la.lat * DEG_TO_RAD
    var phi2 = lb.lat * DEG_TO_RAD
    var dlon = (lb.lon - la.lon) * DEG_TO_RAD

    var u1 = atan2((1.0 - EARTH_F) * sin(phi1), cos(phi1))
    var u2 = atan2((1.0 - EARTH_F) * sin(phi2), cos(phi2))
    var sin_u1 = sin(u1)
    var cos_u1 = cos(u1)
    var sin_u2 = sin(u2)
    var cos_u2 = cos(u2)

    var lam = dlon
    var sin_sigma = 0.0
    var cos_sigma = 1.0
    var sigma = 0.0
    var cos_sq_alpha = 1.0
    var cos_2sigma_m = 1.0

    # The iteration normally converges in a handful of passes; the bound is
    # there so a pathological pair cannot spin forever.
    var iteration = 0
    while iteration < 100:
        var sin_lam = sin(lam)
        var cos_lam = cos(lam)
        sin_sigma = sqrt(
            (cos_u2 * sin_lam) * (cos_u2 * sin_lam)
            + (cos_u1 * sin_u2 - sin_u1 * cos_u2 * cos_lam)
            * (cos_u1 * sin_u2 - sin_u1 * cos_u2 * cos_lam)
        )
        if sin_sigma == 0.0:
            return 0.0  # coincident points
        cos_sigma = sin_u1 * sin_u2 + cos_u1 * cos_u2 * cos_lam
        sigma = atan2(sin_sigma, cos_sigma)
        var sin_alpha = cos_u1 * cos_u2 * sin_lam / sin_sigma
        cos_sq_alpha = 1.0 - sin_alpha * sin_alpha
        # cos_2sigma_m collapses to 0 for equatorial lines, where cos_sq_alpha
        # is also 0; the guarded form avoids a 0/0 there.
        if cos_sq_alpha == 0.0:
            cos_2sigma_m = 0.0
        else:
            cos_2sigma_m = cos_sigma - 2.0 * sin_u1 * sin_u2 / cos_sq_alpha

        var c = EARTH_F / 16.0 * cos_sq_alpha * (4.0 + EARTH_F * (4.0 - 3.0 * EARTH_F))
        var lam_prev = lam
        lam = dlon + (1.0 - c) * EARTH_F * sin_alpha * (
            sigma + c * sin_sigma * (cos_2sigma_m + c * cos_sigma * (-1.0 + 2.0 * cos_2sigma_m * cos_2sigma_m))
        )
        if abs(lam - lam_prev) < 1e-12:
            break
        iteration += 1

    if iteration >= 100:
        # Near-antipodal: Vincenty is known to fail here, so say so by
        # falling back rather than returning a number that is merely plausible.
        return haversine_m(la, lb)

    var u_sq = cos_sq_alpha * (EARTH_A * EARTH_A - EARTH_B * EARTH_B) / (EARTH_B * EARTH_B)
    var big_a = 1.0 + u_sq / 16384.0 * (
        4096.0 + u_sq * (-768.0 + u_sq * (320.0 - 175.0 * u_sq))
    )
    var big_b = u_sq / 1024.0 * (256.0 + u_sq * (-128.0 + u_sq * (74.0 - 47.0 * u_sq)))
    var delta_sigma = big_b * sin_sigma * (
        cos_2sigma_m + big_b / 4.0 * (
            cos_sigma * (-1.0 + 2.0 * cos_2sigma_m * cos_2sigma_m)
            - big_b / 6.0 * cos_2sigma_m * (-3.0 + 4.0 * sin_sigma * sin_sigma)
            * (-3.0 + 4.0 * cos_2sigma_m * cos_2sigma_m)
        )
    )
    return EARTH_B * big_a * (sigma - delta_sigma)


def bearing_deg(a: LatLon, b: LatLon) raises -> Float64:
    """Initial whole-circle bearing from `a` to `b`, in degrees from north.

    This is the *initial* bearing of the great-circle path, which is not the
    same as the bearing of the straight chord. Over survey baselines the two
    differ by well under a second of arc, but on long lines they diverge and
    only the initial value is what a compass reports.
    """
    var la = validate(a)
    var lb = validate(b)

    var phi1 = la.lat * DEG_TO_RAD
    var phi2 = lb.lat * DEG_TO_RAD
    var dlon = (lb.lon - la.lon) * DEG_TO_RAD

    var y = sin(dlon) * cos(phi2)
    var x = cos(phi1) * sin(phi2) - sin(phi1) * cos(phi2) * cos(dlon)
    return wrap_degrees(atan2(y, x) * RAD_TO_DEG)


def midpoint(a: LatLon, b: LatLon) raises -> LatLon:
    """The geographic midpoint of two positions.

    Averaging latitudes and longitudes is wrong across the antimeridian and
    near the poles. Interpolating along the great circle is right, and costs
    two more trig calls.
    """
    var la = LatLon(validate(a))
    var lb = LatLon(validate(b))

    var phi1 = la.lat * DEG_TO_RAD
    var phi2 = lb.lat * DEG_TO_RAD
    var dlon = (lb.lon - la.lon) * DEG_TO_RAD

    var bx = cos(phi2) * cos(dlon)
    var by = cos(phi2) * sin(dlon)
    var phi3 = atan2(sin(phi1) + sin(phi2), sqrt((cos(phi1) + bx) * (cos(phi1) + bx) + by * by))
    var lam3 = atan2(by, cos(phi1) + bx)

    return LatLon(phi3 * RAD_TO_DEG, normalize_lon(lam3 * RAD_TO_DEG), (la.height + lb.height) * 0.5)


# ── local tangent plane ────────────────────────────────────────────────────

struct EnuFrame(Copyable, Writable):
    """A local East-North-Up frame anchored at one point.

    Survey work is done in a flat plane a few kilometres across. This frame
    says which point the plane passes through and how it is oriented, so
    every coordinate in a project can be expressed relative to a single
    reference station.
    """

    var origin: LatLon
    var lon0_rad: Float64
    var lat0_rad: Float64
    var m_per_deg_lat: Float64
    var m_per_deg_lon: Float64

    @staticmethod
    def at(origin: LatLon) raises -> EnuFrame:
        """Build the frame for a reference station."""
        var o = LatLon(validate(origin))
        var lat0 = o.lat * DEG_TO_RAD
        # Metres per degree of latitude varies negligibly over a survey
        # project, so a constant is fine. Longitude scaling depends on
        # latitude and must not be treated as constant.
        var m_per_deg_lat = 111132.92 - 559.82 * cos(2.0 * lat0) + 1.175 * cos(4.0 * lat0)
        var m_per_deg_lon = 111412.84 * cos(lat0) - 93.5 * cos(3.0 * lat0)
        if abs(m_per_deg_lon) < 1e-9:
            # Standing on a pole: longitude has no meaning, and any scale
            # factor would be garbage. Zero is the honest answer.
            m_per_deg_lon = 0.0
        return EnuFrame(o, o.lon * DEG_TO_RAD, lat0, m_per_deg_lat, m_per_deg_lon)

    def to_enu(self, p: LatLon) -> Tuple[Float64, Float64, Float64]:
        """Project a position to `(east, north, up)` metres.

        Uses a flat-earth expansion. Across a few kilometres the error is
        well under a centimetre, which is comfortably inside survey noise.
        """
        var d_north = (p.lat - self.origin.lat) * self.m_per_deg_lat
        var d_east = angular_difference_deg(self.origin.lon, p.lon) * self.m_per_deg_lon
        return (d_east, d_north, p.height - self.origin.height)

    def to_latlon(self, e: Float64, n: Float64, u: Float64) -> LatLon:
        """The inverse of `to_enu`."""
        var lat = self.origin.lat + n / self.m_per_deg_lat
        var lon = normalize_lon(self.origin.lon + e / self.m_per_deg_lon)
        return LatLon(lat, lon, self.origin.height + u)

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"EnuFrame({self.origin.lat}, {self.origin.lon})"))


def forward_azimuth(east: Float64, north: Float64) -> Float64:
    """Azimuth of a local (east, north) offset, in degrees from north."""
    return wrap_degrees(atan2(east, north) * RAD_TO_DEG)


def back_azimuth(az: Float64) -> Float64:
    """The reciprocal bearing: always exactly 180 degrees away.

    Cheaper and more accurate than adding 180 and folding, because it cannot
    drift for an input that was already folded.
    """
    return wrap_degrees(az + 180.0)