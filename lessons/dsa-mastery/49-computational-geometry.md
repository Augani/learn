# Lesson 49: Computational Geometry

> **Analogy**: Geometry algorithms often look like they are about points
> and lines, but the real challenge is keeping the combinatorics under
> control. A geometric problem becomes algorithmic when you find the
> right invariant: turn direction, sorted order, event structure, or a
> carefully constrained divide-and-conquer split.

---

## Why This Matters

Computational geometry appears wherever the physical world meets
algorithmic abstraction:

- **Mapping and GIS**: computing visible horizons, area coverage, and
  route boundaries from GPS point clouds
- **Graphics and game engines**: collision detection, visibility culling,
  and convex hulls for bounding volumes
- **Robotics and motion planning**: finding paths around polygonal
  obstacles using configuration-space geometry
- **Clustering and spatial data analysis**: nearest-neighbor queries,
  Voronoi diagrams, and density estimation
- **Computer-aided design (CAD)**: Boolean operations on polygons and
  mesh intersection testing
- **Autonomous vehicles**: LiDAR point processing, lane boundary
  detection, and object boundary extraction

This lesson covers the foundational techniques:

- **Convex hull**: the smallest enclosing convex shape
- **Line segment intersection**: a primitive that drives many algorithms
- **Closest pair of points**: divide-and-conquer in geometric space
- **Sweep line**: processing events in sorted order for efficiency

---

## Convex Hull

### Problem

Given a set of points, find the smallest convex polygon containing all
of them.

### Geometric intuition

Imagine stretching a rubber band around the outside points.
The shape the band forms is the convex hull.

### Orientation / cross product

The key test is whether three points make a left turn or a right turn.

If the turn is wrong for the hull direction, the middle point should be
removed.

### Andrew's monotone chain

1. sort points lexicographically
2. build lower hull
3. build upper hull
4. concatenate

### ASCII hull construction

```
  Points:
      *       *
   *     *
      *
 *            *

  Hull keeps only the outer boundary points.
```

#### Python

```python
def convex_hull(points: list[tuple[int, int]]) -> list[tuple[int, int]]:
    def cross(origin: tuple[int, int], first: tuple[int, int], second: tuple[int, int]) -> int:
        return (first[0] - origin[0]) * (second[1] - origin[1]) - (first[1] - origin[1]) * (second[0] - origin[0])

    points = sorted(set(points))
    if len(points) <= 1:
        return points

    lower: list[tuple[int, int]] = []
    for point in points:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], point) <= 0:
            lower.pop()
        lower.append(point)

    upper: list[tuple[int, int]] = []
    for point in reversed(points):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], point) <= 0:
            upper.pop()
        upper.append(point)

    return lower[:-1] + upper[:-1]
```

---

## Line Segment Intersection

The basic question is whether two line segments intersect.

The orientation test again becomes the central primitive.

If two segments straddle each other in orientation terms, they intersect
in the general case.

This is a good example of how one geometric primitive can drive many
apparently different algorithms.

---

## Closest Pair of Points

You already saw the divide-and-conquer perspective in Phase 5.
Now the geometric interpretation matters more.

### Brute force

Check every pair:

$$
O(n^2)
$$

### Faster idea

1. split points by x-coordinate
2. recursively solve left and right halves
3. let `d` be the best distance from the two halves
4. only inspect points within distance `d` of the dividing line

The critical geometric fact is that only a constant number of nearby
points in the strip need to be checked for each point.

This is what keeps the combine step linear.

---

## Sweep Line Algorithms

### Core idea

Imagine a vertical line sweeping from left to right across the plane.
Maintain a data structure representing the current active geometry.

Sweep line is useful when:

- events happen in sorted coordinate order
- only nearby active objects matter

Examples:

- segment intersection detection
- interval overlap
- rectangle union and skyline variants

### Event-processing intuition

```
  sweep line ->

  process event points in x-order
  update active set
  query nearby active geometry
```

This idea appears across many advanced geometric problems.

---

## Exercises

1. Why is orientation testing (cross product) central to convex hull
   algorithms? What does a positive cross product tell you about three
   points?
2. What does the rubber-band analogy mean mathematically? Why must the
   convex hull boundary only contain left turns (or right turns,
   depending on direction)?
3. Why does the closest-pair divide-and-conquer combine step not become
   quadratic again? How many points must be checked in the strip for
   each point, and why is that number bounded by a constant?
4. What kind of problem structure suggests a sweep line approach?
   When would sweep line fail to improve over brute force?
5. Give one example where geometry reduces to maintaining an active set.
   How does the active set get updated as the sweep line progresses?
6. Explain why sorting points lexicographically is the first step in
   Andrew's monotone chain convex hull algorithm. What would go wrong
   without sorting?
7. Design a brute-force algorithm for line segment intersection among `n`
   segments. What is its runtime? How does sweep line improve this?
8. In the closest pair of points problem, why is it sufficient to check
   points within distance `d` of the dividing line, where `d` is the
   minimum of the two halves?

---

## Key Takeaways

- **Computational geometry** is driven by a small set of geometric
  invariants: orientation (cross product), sorted event order, and
  carefully constrained divide-and-conquer splits.
- **Convex hull algorithms** rely on turn tests to maintain boundary
  convexity. Andrew's monotone chain sorts points and builds lower/upper
  hulls in `O(n log n)` time.
- **Line segment intersection** reduces to orientation tests. Two segments
  intersect if their endpoints straddle each other in orientation terms.
- **Closest pair of points** is a classic geometric divide-and-conquer
  win: split by x-coordinate, solve halves recursively, then check a
  narrow strip around the dividing line in linear time.
- **Sweep line algorithms** process events in sorted coordinate order
  while maintaining an active set of "current" objects. They work when
  only nearby active objects interact.
- **Many geometric problems become manageable only after the right
  invariant is identified** — the algorithmic insight is often geometric,
  not combinatorial.

The next lesson steps away from efficient exact algorithms and studies
the limits of tractability with NP-completeness.

---

**Previous**: [Lesson 48 — Randomized Algorithms](./48-randomized-algorithms.md)
**Next**: [Lesson 50 — NP-Completeness and Computational Complexity](./50-np-completeness.md)