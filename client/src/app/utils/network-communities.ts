/**
 * Communities in a network: groups of nodes with more ties among themselves
 * than chance would give, found from the ties alone by the Louvain method
 * (modularity, ties weighted, direction ignored). It knows nothing of
 * dioceses or orders, which is the point: the groups can then be set against
 * them. Deterministic for a given graph; computed over the graph drawn.
 */
export interface CommunityRow {
  group: string;
  label: string;
  color: string;
  size: number;
  /** Its members by the other attribute (their diocese), largest first: [name, share of the community]. */
  parts: { name: string; share: number }[];
}

export interface Communities {
  rows: CommunityRow[];
  /** Communities left out of `rows` (the smallest). */
  more: number;
  count: number;
  /** Share of all nodes whose own diocese is the largest in their community. */
  agreement: number;
  /** Communities where no diocese holds four in five of the members. */
  mixed: number;
  /** Nodes in the communities too small to name. */
  smaller: number;
}

type Graph = Map<number, number>[];

/** One pass of local moves: each node to the neighbouring community that gains most modularity. */
function localMoves(graph: Graph): { comm: number[]; moved: boolean } {
  const n = graph.length;
  const degree = graph.map(nbrs => { let k = 0; nbrs.forEach(w => k += w); return k; });
  const m2 = degree.reduce((s, k) => s + k, 0);
  const comm = graph.map((_, i) => i);
  const total = [...degree];
  let moved = false;
  if (!m2) return { comm, moved };
  for (let round = 0; round < 25; round++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      const own = comm[i];
      total[own] -= degree[i];
      const to = new Map<number, number>([[own, 0]]);
      graph[i].forEach((w, j) => { if (j !== i) to.set(comm[j], (to.get(comm[j]) ?? 0) + w); });
      let best = own, gain = (to.get(own) ?? 0) - total[own] * degree[i] / m2;
      to.forEach((w, c) => {
        const g = w - total[c] * degree[i] / m2;
        if (g > gain + 1e-12) { gain = g; best = c; }
      });
      total[best] += degree[i];
      if (best !== own) { comm[i] = best; changed = moved = true; }
    }
    if (!changed) break;
  }
  return { comm, moved };
}

/** Each node's community, as "Community 1" (the largest), "Community 2"… */
export function detectCommunities(
  nodes: { id: string }[],
  edges: { from: string; to: string; weight?: number }[],
): Map<string, string> {
  const ids = nodes.map(n => String(n.id));
  const index = new Map(ids.map((id, i) => [id, i]));
  let graph: Graph = ids.map(() => new Map());
  for (const e of edges) {
    const a = index.get(String(e.from)), b = index.get(String(e.to));
    if (a == null || b == null || a === b) continue;
    const w = Number(e.weight) || 1;
    graph[a].set(b, (graph[a].get(b) ?? 0) + w);
    graph[b].set(a, (graph[b].get(a) ?? 0) + w);
  }
  // each original node's group, as groups are merged level by level
  let groupOf = ids.map((_, i) => i);
  for (let level = 0; level < 12; level++) {
    const { comm, moved } = localMoves(graph);
    if (!moved) break;
    const renumber = new Map<number, number>();
    for (const c of comm) if (!renumber.has(c)) renumber.set(c, renumber.size);
    groupOf = groupOf.map(g => renumber.get(comm[g])!);
    const next: Graph = Array.from({ length: renumber.size }, () => new Map());
    graph.forEach((nbrs, i) => {
      const ci = renumber.get(comm[i])!;
      nbrs.forEach((w, j) => {
        const cj = renumber.get(comm[j])!;
        next[ci].set(cj, (next[ci].get(cj) ?? 0) + w);
      });
    });
    graph = next;
  }
  const sizes = new Map<number, number>();
  for (const g of groupOf) sizes.set(g, (sizes.get(g) ?? 0) + 1);
  const rank = new Map([...sizes.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([g], i) => [g, i + 1]));
  // the largest get a name and a colour; pairs and the long tail share one
  const named = (g: number) => rank.get(g)! <= MAX_NAMED && sizes.get(g)! >= 3;
  return new Map(ids.map((id, i) => [id, named(groupOf[i]) ? `Community ${rank.get(groupOf[i])}` : SMALLER]));
}

/** How many communities get their own colour. */
const MAX_NAMED = 15;
/** The group every smaller community is folded into. */
export const SMALLER = 'Smaller communities';

const MAX_ROWS = 12;

/** The communities set against another attribute of their members (the diocese). */
export function describeCommunities(
  nodes: { id: string; group?: string }[],
  other: (n: any) => string,
  key: { group: string; label: string; color: string; count: number }[],
): Communities | null {
  const smaller = key.find(k => k.group === SMALLER)?.count ?? 0;
  key = key.filter(k => k.group !== SMALLER);
  nodes = nodes.filter(n => n.group !== SMALLER);
  if (key.length < 2) return null;
  const members = new Map<string, Map<string, number>>();
  for (const n of nodes) {
    const c = n.group || 'Unknown';
    const m = members.get(c) ?? members.set(c, new Map()).get(c)!;
    const o = other(n) || 'Unknown';
    m.set(o, (m.get(o) ?? 0) + 1);
  }
  let led = 0, mixed = 0;
  const rows = key.map(k => {
    const m = [...(members.get(k.group) ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
    led += m[0]?.[1] ?? 0;
    if ((m[0]?.[1] ?? 0) < 0.8 * k.count) mixed++;
    return { group: k.group, label: k.label, color: k.color, size: k.count,
      parts: m.slice(0, 3).map(([name, count]) => ({ name, share: count / k.count })) };
  });
  return { rows: rows.slice(0, MAX_ROWS), more: Math.max(0, rows.length - MAX_ROWS), count: rows.length,
    agreement: nodes.length ? led / nodes.length : 0, mixed, smaller };
}
