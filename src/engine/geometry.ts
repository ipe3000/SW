export type Point = { x: number; y: number };
export const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const inside = (p: Point) => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x < 10 && p.y >= 0 && p.y < 10;
export const key = (p: Point) => `${p.x},${p.y}`;
export const square = (p: Point) => `${String.fromCharCode(65 + p.x)}${10 - p.y}`;
export const adjacent = (p: Point): Point[] => [{ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 }].filter(inside);

/** Segment between cell centres; a single corner touch is transparent. */
export function visible(from: Point, to: Point, blockers: Point[]): boolean {
  if (!inside(from) || !inside(to)) return false;
  if (same(from, to)) return true;
  const origin = [from.x + .5, from.y + .5], delta = [to.x - from.x, to.y - from.y];
  const corners = new Map<string, number>();
  for (const cell of blockers) {
    if (same(cell, from) || same(cell, to)) continue;
    let enter = 0, exit = 1, hit = true;
    for (let axis = 0; axis < 2; axis++) {
      const low = axis === 0 ? cell.x : cell.y;
      if (delta[axis] === 0) { if (origin[axis] < low || origin[axis] > low + 1) hit = false; }
      else {
        const a = (low - origin[axis]) / delta[axis], b = (low + 1 - origin[axis]) / delta[axis];
        enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
      }
    }
    if (!hit || enter > exit + 1e-9 || exit <= 0 || enter >= 1) continue;
    if (exit - enter > 1e-9) return false;
    const corner = `${Math.round(origin[0] + delta[0] * enter)},${Math.round(origin[1] + delta[1] * enter)}`;
    const count = (corners.get(corner) ?? 0) + 1;
    if (count >= 2) return false;
    corners.set(corner, count);
  }
  return true;
}

export function shortestPath(from: Point, to: Point, max: number, canEnter: (p: Point) => boolean, canStop = canEnter): Point[] | null {
  if (!inside(to) || !canStop(to)) return null;
  if (same(from, to)) return [];
  const queue: { p: Point; path: Point[] }[] = [{ p: from, path: [] }];
  const visited = new Set([key(from)]);
  for (let i = 0; i < queue.length; i++) {
    const { p, path } = queue[i];
    if (path.length >= max) continue;
    for (const next of adjacent(p)) {
      if (visited.has(key(next)) || !canEnter(next)) continue;
      const route = [...path, next];
      if (same(next, to)) return route;
      visited.add(key(next)); queue.push({ p: next, path: route });
    }
  }
  return null;
}
