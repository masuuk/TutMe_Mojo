# vec.mojo — fixed-size 2D and 3D vectors.
#
# Geometric and physical libraries lean on vectors constantly, so the kernel
# supplies them once. `Vec2` and `Vec3` are plain structs of Float64 fields:
# no heap, no generics, no traits beyond what they need. For a type this
# small and this hot, that is the right amount of machinery.
#
# Note the deliberate absence of a `Vec[T]` with a runtime length. If you
# need one of those, you want `List[Float64]`. Two vector types with
# overlapping names and different semantics is a reliable way to ship a bug.

from std.math import sqrt

# Below this, two vectors are treated as coincident for the purposes of
# division by their difference.
comptime VEC_EPS: Float64 = 1e-12


# ── Vec2 ────────────────────────────────────────────────────────────────────

struct Vec2(Copyable, Writable):
    """A point or displacement in the plane."""

    var x: Float64
    var y: Float64

    def __init__(out self, x: Float64 = 0.0, y: Float64 = 0.0):
        self.x = x
        self.y = y

    # Accessors. Mojo has no public fields-by-default, and an explicit getter
    # documents intent: `.x` is a component, `.length` is a derived quantity
    # that costs a square root to compute.
    def length(self) -> Float64:
        return sqrt(self.x * self.x + self.y * self.y)

    def length_squared(self) -> Float64:
        """`|v|^2` without the square root.

        Use this for comparisons and least-squares work; you almost never
        need the square root itself, and skipping it is both faster and
        numerically kinder.
        """
        return self.x * self.x + self.y * self.y

    def normalized(self) raises -> Vec2:
        """The unit vector in the same direction. Raises on a zero vector."""
        var m = self.length()
        if m < VEC_EPS:
            raise "Vec2.normalized: zero-length vector"
        return Vec2(self.x / m, self.y / m)

    def dot(self, other: Vec2) -> Float64:
        return self.x * other.x + self.y * other.y

    def perpendicular(self) -> Vec2:
        """Rotated 90 degrees counter-clockwise."""
        return Vec2(-self.y, self.x)

    def scale(self, k: Float64) -> Vec2:
        return Vec2(self.x * k, self.y * k)

    def __add__(self, other: Vec2) -> Vec2:
        return Vec2(self.x + other.x, self.y + other.y)

    def __sub__(self, other: Vec2) -> Vec2:
        return Vec2(self.x - other.x, self.y - other.y)

    def __neg__(self) -> Vec2:
        return Vec2(-self.x, -self.y)

    def __getitem__(self, i: Int) raises -> Float64:
        """Index 0 is x, index 1 is y. Lets a caller loop without branching."""
        if i == 0:
            return self.x
        if i == 1:
            return self.y
        raise String(t"Vec2: index {i} out of range")

    def __len__(self) -> Int:
        return 2

    def write_to(self, mut writer: Some[Writer]):
        """Makes `Vec2` printable, and usable inside a `t"..."` format."""
        writer.write(String(t"({self.x}, {self.y})"))


# ── Vec3 ────────────────────────────────────────────────────────────────────

struct Vec3(Copyable, Writable):
    """A point, displacement or direction in space."""

    var x: Float64
    var y: Float64
    var z: Float64

    def __init__(out self, x: Float64 = 0.0, y: Float64 = 0.0, z: Float64 = 0.0):
        self.x = x
        self.y = y
        self.z = z

    def length(self) -> Float64:
        return sqrt(self.x * self.x + self.y * self.y + self.z * self.z)

    def length_squared(self) -> Float64:
        return self.x * self.x + self.y * self.y + self.z * self.z

    def normalized(self) raises -> Vec3:
        var m = self.length()
        if m < VEC_EPS:
            raise "Vec3.normalized: zero-length vector"
        return Vec3(self.x / m, self.y / m, self.z / m)

    def dot(self, other: Vec3) -> Float64:
        return self.x * other.x + self.y * other.y + self.z * other.z

    def cross(self, other: Vec3) -> Vec3:
        """The right-handed cross product.

        The single most-used formula in 3D mechanics, and the one most often
        written from memory. Written longhand on purpose.
        """
        return Vec3(
            self.y * other.z - self.z * other.y,
            self.z * other.x - self.x * other.z,
            self.x * other.y - self.y * other.x,
        )

    def scale(self, k: Float64) -> Vec3:
        return Vec3(self.x * k, self.y * k, self.z * k)

    def __add__(self, other: Vec3) -> Vec3:
        return Vec3(self.x + other.x, self.y + other.y, self.z + other.z)

    def __sub__(self, other: Vec3) -> Vec3:
        return Vec3(self.x - other.x, self.y - other.y, self.z - other.z)

    def __neg__(self) -> Vec3:
        return Vec3(-self.x, -self.y, -self.z)

    def __len__(self) -> Int:
        return 3

    def __getitem__(self, i: Int) raises -> Float64:
        if i == 0:
            return self.x
        if i == 1:
            return self.y
        if i == 2:
            return self.z
        raise String(t"Vec3: index {i} out of range")

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"({self.x}, {self.y}, {self.z})"))


# ── free functions ──────────────────────────────────────────────────────────

def lerp2(a: Vec2, b: Vec2, t: Float64) -> Vec2:
    """Componentwise linear interpolation between two points."""
    return Vec2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)


def distance(a: Vec2, b: Vec2) -> Float64:
    return (b - a).length()


def centroid(points: List[Vec2]) raises -> Vec2:
    """The arithmetic mean of a non-empty point list."""
    if len(points) == 0:
        raise "centroid: empty point list"
    var sx = 0.0
    var sy = 0.0
    for i in range(len(points)):
        sx += points[i].x
        sy += points[i].y
    var n = Float64(len(points))
    return Vec2(sx / n, sy / n)


def bounding_box(points: List[Vec2]) raises -> Tuple[Vec2, Vec2]:
    """Axis-aligned `(min_corner, max_corner)` of a non-empty point list.

    Returns a tuple rather than a struct because there is nothing else to say
    about the result, and a two-element tuple documents that at the call site.
    """
    if len(points) == 0:
        raise "bounding_box: empty point list"
    var lo = points[0]
    var hi = points[0]
    for i in range(1, len(points)):
        var p = points[i]
        if p.x < lo.x:
            lo.x = p.x
        if p.y < lo.y:
            lo.y = p.y
        if p.x > hi.x:
            hi.x = p.x
        if p.y > hi.y:
            hi.y = p.y
    return (lo, hi)