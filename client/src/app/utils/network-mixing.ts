/**
 * How far a network's ties stay within a category of its nodes (a diocese, a
 * kind of institution, a religious order…), against what would happen if the
 * ties ignored the category. Counted in tie ends: each tie has two, one in
 * each node's category.
 */
export interface MixingRow {
  group: string;
  label: string;
  color: string;
  nodes: number;
  /** Tie ends that fall in this category. */
  ends: number;
  /** Share of this category's tie ends whose other end is in the same category. */
  within: number;
  /** The same share if ties ignored the category: its share of all tie ends. */
  expected: number;
}

export interface Mixing {
  rows: MixingRow[];
  /** Categories left out of `rows` (the smallest). */
  more: number;
  ties: number;
  /** Share of all ties that join two nodes of one category. */
  within: number;
  /** That share if ties ignored the category. */
  expected: number;
}

const MAX_ROWS = 12;

export function computeMixing(
  nodes: { id: string; group?: string }[],
  edges: { from: string; to: string }[],
  key: { group: string; label: string; color: string; count: number }[],
): Mixing | null {
  const groupOf = new Map(nodes.map(n => [String(n.id), n.group || 'Unknown']));
  const ends = new Map<string, number>();
  const inside = new Map<string, number>();
  let ties = 0, same = 0;
  for (const e of edges) {
    const a = groupOf.get(String(e.from)), b = groupOf.get(String(e.to));
    if (a == null || b == null) continue;
    ties++;
    ends.set(a, (ends.get(a) ?? 0) + 1);
    ends.set(b, (ends.get(b) ?? 0) + 1);
    if (a === b) { same++; inside.set(a, (inside.get(a) ?? 0) + 2); }
  }
  if (!ties || key.length < 2) return null;
  const rows = key.map(k => {
    const n = ends.get(k.group) ?? 0;
    return { group: k.group, label: k.label, color: k.color, nodes: k.count, ends: n,
      within: n ? (inside.get(k.group) ?? 0) / n : 0, expected: n / (2 * ties) };
  }).filter(r => r.ends > 0).sort((x, y) => y.ends - x.ends);
  return {
    rows: rows.slice(0, MAX_ROWS), more: Math.max(0, rows.length - MAX_ROWS), ties,
    within: same / ties,
    expected: rows.reduce((s, r) => s + r.expected ** 2, 0),
  };
}
