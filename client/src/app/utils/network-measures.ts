/**
 * Two plain measures of a node's place in the graph on screen, for the
 * details card and the exports. Edges are taken as undirected and unweighted.
 *
 * - links: how many other nodes it is tied to (degree).
 * - betweenness: the share of shortest paths between other nodes that pass
 *   through it, 0–1 (Brandes' algorithm): high for go-betweens that join
 *   otherwise separate parts of the network.
 */
export interface NodeMeasures {
  links: number;
  linksRank: number;
  /** null when the graph is too large to compute it promptly. */
  betweenness: number | null;
  betweennessRank: number | null;
  /** Nodes in the graph (what the ranks are out of). */
  of: number;
}

/** Brandes is O(nodes × edges): fine for the few thousand nodes a view draws. */
export const MAX_BETWEENNESS_NODES = 2500;

export function computeMeasures(nodes: { id: any }[], edges: { from: any; to: any }[]): Map<string, NodeMeasures> {
  const ids = nodes.map(n => String(n.id));
  const index = new Map(ids.map((id, i) => [id, i]));
  const adj: Set<number>[] = ids.map(() => new Set());
  for (const e of edges) {
    const a = index.get(String(e.from)), b = index.get(String(e.to));
    if (a === undefined || b === undefined || a === b) continue;
    adj[a].add(b);
    adj[b].add(a);
  }
  const n = ids.length;
  const neighbours = adj.map(s => [...s]);
  const degree = neighbours.map(s => s.length);
  const between = n <= MAX_BETWEENNESS_NODES ? brandes(neighbours) : null;
  if (between) {
    // undirected: each pair counted from both ends; normalise to the share of pairs
    const pairs = (n - 1) * (n - 2);
    for (let i = 0; i < n; i++) between[i] = pairs > 0 ? between[i] / pairs : 0;
  }
  const degreeRank = ranks(degree);
  const betweenRank = between ? ranks(between) : null;
  return new Map(ids.map((id, i) => [id, {
    links: degree[i],
    linksRank: degreeRank[i],
    betweenness: between ? between[i] : null,
    betweennessRank: betweenRank ? betweenRank[i] : null,
    of: n,
  }]));
}

/** Competition ranks, highest first: [5, 9, 9, 1] → [3, 1, 1, 4]. */
function ranks(values: ArrayLike<number>): number[] {
  const order = Array.from(values, (v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
  const out = new Array<number>(values.length);
  order.forEach(([v, i], k) => out[i] = k > 0 && order[k - 1][0] === v ? out[order[k - 1][1]] : k + 1);
  return out;
}

/** Unnormalised betweenness for an unweighted graph (Brandes 2001). */
function brandes(adj: number[][]): Float64Array {
  const n = adj.length;
  const cb = new Float64Array(n);
  const sigma = new Float64Array(n), delta = new Float64Array(n);
  const dist = new Int32Array(n);
  const stack = new Int32Array(n), queue = new Int32Array(n);
  const preds: number[][] = Array.from({ length: n }, () => []);
  for (let s = 0; s < n; s++) {
    sigma.fill(0); dist.fill(-1); delta.fill(0);
    for (const p of preds) p.length = 0;
    sigma[s] = 1; dist[s] = 0;
    let head = 0, tail = 0, top = 0;
    queue[tail++] = s;
    while (head < tail) {
      const v = queue[head++];
      stack[top++] = v;
      for (const w of adj[v]) {
        if (dist[w] < 0) { dist[w] = dist[v] + 1; queue[tail++] = w; }
        if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; preds[w].push(v); }
      }
    }
    while (top > 0) {
      const w = stack[--top];
      for (const v of preds[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      if (w !== s) cb[w] += delta[w];
    }
  }
  return cb;
}

/** 1 → "1st", 22 → "22nd". */
export function ordinal(k: number): string {
  const tens = k % 100, ones = k % 10;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ones === 1 ? 'st' : ones === 2 ? 'nd' : ones === 3 ? 'rd' : 'th';
  return `${k.toLocaleString()}${suffix}`;
}
