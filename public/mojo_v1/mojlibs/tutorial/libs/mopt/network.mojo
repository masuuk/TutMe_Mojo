# network.mojo — shortest paths and minimum spanning trees.
#
# Two graph algorithms that between them answer most of what is asked about a
# network, and both of which are taught badly because the code is
# deceptively short. The comments here carry the weight: the interesting
# content is not the loop, it is *why* Dijkstra requires non-negative weights
# and what actually goes wrong on a network that has them.

from mojo_core import Matrix

comptime NO_EDGE: Float64 = 1.0e18


struct Graph(Copyable):
    """An undirected weighted graph.

    Held as an adjacency *matrix* rather than a list of edge lists. That is
    the wrong choice for sparse graphs, and the tutorial makes it anyway,
    because a matrix makes every invariant visible and checkable in three
    lines, and because the sizes involved here are small. A production
    version would store adjacency lists and accept the loss of clarity that
    brings.

    The vertex count is named `n` rather than `size`, because `size` reads
    like a collection length, and nothing about a graph's vertex count is a
    collection length.
    """

    var n: Int
    var weight: Matrix
    var undirected: Bool

    # `raises` is inherited, not chosen: constructing the adjacency matrix
    # can fail on a negative dimension or an oversized request, and a
    # constructor that swallows that would hand back a half-built graph.
    def __init__(out self, n: Int, undirected: Bool = True) raises:
        self.n = n
        self.undirected = undirected
        self.weight = Matrix(n, n)
        for i in range(n):
            for j in range(n):
                if i == j:
                    self.weight.set(i, j, 0.0)
                else:
                    self.weight.set(i, j, NO_EDGE)

    def add_edge(mut self, a: Int, b: Int, w: Float64) raises:
        if a < 0 or a >= self.n or b < 0 or b >= self.n:
            raise "add_edge: vertex out of range"
        if self.undirected:
            self.weight.set(a, b, w)
            self.weight.set(b, a, w)
        else:
            self.weight.set(a, b, w)

    def edge(self, a: Int, b: Int) raises -> Float64:
        return self.weight.get(a, b)

    def has_edge(self, a: Int, b: Int) raises -> Bool:
        return self.weight.get(a, b) < NO_EDGE

    def degree(self, a: Int) raises -> Int:
        var count = 0
        for j in range(self.n):
            if a == j:
                continue
            if self.weight.get(a, j) < NO_EDGE:
                count += 1
        return count


# ── shortest paths ──────────────────────────────────────────────────────────

def dijkstra(graph: Graph, source: Int) raises -> List[Float64]:
    """Shortest distance from `source` to every vertex.

    Requires non-negative edge weights, and the requirement is not
    technical. Dijkstra commits to a vertex's distance the moment that vertex
    is settled; if a later edge could still shorten it, the answer is already
    wrong. A negative edge does exactly that -- it makes a path through an
    unsettled vertex cheaper than the best settled one, which breaks the
    invariant the entire algorithm rests on.

    Roads are non-negative, so road networks are the natural application.
    Networks with rebates, credits, or profit encoded as negative cost are
    not, and reaching for Dijkstra there is a genuine bug rather than a
    performance question.
    """
    var n = graph.n
    if source < 0 or source >= n:
        raise "dijkstra: source out of range"

    var dist = List[Float64]()
    var done = List[Bool]()
    for _ in range(n):
        dist.append(NO_EDGE)
        done.append(False)
    dist[source] = 0.0

    for _ in range(n):
        # Settle the nearest unsettled vertex. With a matrix this is a linear
        # scan; with a priority queue it would be O(log n) per step, which is
        # the whole reason to use one at scale.
        var u = -1
        var best = NO_EDGE
        for v in range(n):
            if not done[v] and dist[v] < best:
                best = dist[v]
                u = v
        if u < 0:
            break                      # everything reachable is settled
        done[u] = True

        for v in range(n):
            if done[v] or v == u:
                continue
            var w = graph.weight.get(u, v)
            if w >= NO_EDGE:
                continue               # no such edge
            var candidate = dist[u] + w
            if candidate < dist[v]:
                dist[v] = candidate
    return dist


def shortest_path(graph: Graph, source: Int, target: Int) raises -> List[Int]:
    """The vertex sequence from `source` to `target`, inclusive.

    Returned as a path rather than a distance because the distance alone is
    rarely what a caller wants, and because reconstructing the path is where
    Dijkstra implementations usually go wrong. The predecessor array is the
    only extra structure needed, and it is the part most often omitted.
    """
    var n = graph.n
    var dist = List[Float64]()
    var prev = List[Int]()
    var done = List[Bool]()
    for _ in range(n):
        dist.append(NO_EDGE)
        prev.append(-1)
        done.append(False)
    dist[source] = 0.0

    for _ in range(n):
        var u = -1
        var best = NO_EDGE
        for v in range(n):
            if not done[v] and dist[v] < best:
                best = dist[v]
                u = v
        if u < 0:
            break
        done[u] = True
        for v in range(n):
            var w = graph.weight.get(u, v)
            if w >= NO_EDGE:
                continue
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                prev[v] = u

    if dist[target] >= NO_EDGE:
        raise "shortest_path: target is not reachable from source"

    # Walk the predecessors back to the source, then reverse. `-1` marks the
    # source, since nothing ever sets its predecessor.
    var path = List[Int]()
    var at = target
    while at != -1:
        path.append(at)
        at = prev[at]
    return reverse(path)


def reverse(items: List[Int]) -> List[Int]:
    var out = List[Int]()
    var i = len(items) - 1
    while i >= 0:
        out.append(items[i])
        i -= 1
    return out


# ── minimum spanning tree ───────────────────────────────────────────────────

struct SpanningTree(Copyable, Writable):
    """The result of a minimum spanning tree computation.

    `connected` is reported separately from `edges` because a forest and a
    tree differ only in that one flag, and a disconnected graph produces a
    perfectly valid-looking list of edges that connects nothing.
    """

    var total_weight: Float64
    var edges: List[Tuple[Int, Int]]
    var connected: Bool

    def edge_count(self) -> Int:
        return len(self.edges)

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"SpanningTree({self.edge_count()} edges, {self.total_weight})"))


def find(mut parent: List[Int], x: Int) -> Int:
    """Union-find lookup with path halving.

    `mut` because path halving compresses the tree in place as it searches.
    Without the compression this is O(n) per lookup and the algorithm degrades
    badly; with it, the amortised cost is very nearly constant.
    """
    var root = x
    while parent[root] != root:
        root = parent[root]
    var at = x
    while parent[at] != at:
        var next = parent[at]
        parent[at] = root
        at = next
    return root


def minimum_spanning_tree(graph: Graph) raises -> SpanningTree:
    """The cheapest structure connecting every vertex, by Kruskal's algorithm.

    Kruskal sorts the edges by weight and adds each one that joins two
    different components. The correctness argument is a cut property: for
    any cut of the graph, the cheapest edge crossing it belongs to *some*
    minimum spanning tree. Kruskal never adds an edge crossing a cut without
    it being the cheapest such edge at that moment, which is why this greedy
    choice is safe and almost no other greedy choice is.

    The alternative, Prim's, grows one tree outward from a single vertex.
    Both are correct; Kruskal is usually preferred because the sort it needs
    is straightforward and the component tracking is nearly free at matrix
    densities.
    """
    var n = graph.n

    # Collect the edges into three parallel arrays rather than a list of
    # tuples. Sorting a list of tuples by their second component would need
    # a comparator and a higher-order function; sorting a parallel weight
    # array needs neither, allocates nothing extra, and is far easier to
    # verify by eye.
    var starts = List[Int]()
    var ends = List[Int]()
    var weights = List[Float64]()
    for i in range(n):
        for j in range(i + 1, n):
            var w = graph.weight.get(i, j)
            if w < NO_EDGE:
                starts.append(i)
                ends.append(j)
                weights.append(w)

    _sort_by_weight(weights, starts, ends)

    var parent = List[Int]()
    for i in range(n):
        parent.append(i)

    var chosen = List[Tuple[Int, Int]]()
    var total = 0.0
    for k in range(len(weights)):
        var a = find(parent, starts[k])
        var b = find(parent, ends[k])
        if a == b:
            continue                 # would close a cycle
        parent[a] = b
        chosen.append((starts[k], ends[k]))
        total += weights[k]

    return SpanningTree(total, chosen, len(chosen) == n - 1)


def _sort_by_weight(
    mut weights: List[Float64], mut starts: List[Int], mut ends: List[Int]
):
    """Insertion sort over three parallel arrays, keyed on `weights`.

    O(n^2), and deliberately so. A graph large enough for that to matter
    should not be stored as a matrix at all, so a cleverer sort here would be
    optimising a representation already known to be the wrong one.
    """
    var m = len(weights)
    for i in range(1, m):
        var kw = weights[i]
        var ks = starts[i]
        var ke = ends[i]
        var j = i - 1
        while j >= 0 and weights[j] > kw:
            weights[j + 1] = weights[j]
            starts[j + 1] = starts[j]
            ends[j + 1] = ends[j]
            j -= 1
        weights[j + 1] = kw
        starts[j + 1] = ks
        ends[j + 1] = ke


# ── tours ───────────────────────────────────────────────────────────────────

def tour_length(graph: Graph, order: List[Int]) raises -> Float64:
    """Total length of the walk visiting vertices in `order`.

    Raises when two consecutive entries are not joined by an edge, because a
    tour through a missing edge has no length at all and returning the sum of
    the edges that do exist would quietly answer a different question.
    """
    var total = 0.0
    for i in range(len(order) - 1):
        var w = graph.weight.get(order[i], order[i + 1])
        if w >= NO_EDGE:
            raise "tour_length: consecutive vertices are not joined"
        total += w
    return total


def nearest_neighbour_tour(graph: Graph, start: Int = 0) raises -> List[Int]:
    """A cheap tour: always go to the nearest unvisited vertex.

    Included as the honest baseline for the exponential problem of finding
    the optimal tour. It is often 25% worse than optimal and sometimes much
    worse, which is the point: a bad-but-fast answer that is measured
    against a known-good one is more useful than a slow search nobody runs.
    """
    var n = graph.n
    if start < 0 or start >= n:
        raise "nearest_neighbour_tour: start out of range"

    var visited = List[Bool]()
    for _ in range(n):
        visited.append(False)
    var order = List[Int]()
    var at = start
    for _ in range(n):
        visited[at] = True
        order.append(at)
        var next = -1
        var best = NO_EDGE
        for v in range(n):
            if visited[v]:
                continue
            var w = graph.weight.get(at, v)
            if w < best:
                best = w
                next = v
        if next < 0:
            break
        at = next
    return order