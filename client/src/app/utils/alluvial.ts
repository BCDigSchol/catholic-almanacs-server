import * as d3 from 'd3';

/**
 * An alluvial (flow) chart: a column per step, each a stack of categories
 * sized by how many are in it, with ribbons from one step to the next sized
 * by how many made that move. A category keeps its colour and its height on
 * the page across the columns, so a ribbon that stays level stayed put.
 * Text is styled by the host (.alluvial-head, .alluvial-label, .alluvial-count).
 */
export interface AlluvialData {
  /** Column headings, e.g. "First post". */
  columns: string[];
  /** In stacking order, top to bottom. */
  categories: { id: string; label: string; color: string }[];
  /** Per column: category id → how many. */
  steps: Record<string, number>[];
  /** links[k]: from column k to k + 1. */
  links: { from: string; to: string; n: number }[][];
}

export interface AlluvialOptions {
  /** The hover text of a ribbon from column k to k + 1. */
  title: (k: number, from: string, to: string, n: number) => string;
  /** The chart's accessible name. */
  label: string;
}

const NODE = 14;
const GAP = 7;

export function drawAlluvial(host: HTMLElement, data: AlluvialData, options: AlluvialOptions): void {
  const root = d3.select(host);
  root.selectAll('*').remove();
  const width = host.clientWidth;
  if (!width || !data.steps.length) return;
  const wide = width >= 720;
  const left = wide ? 236 : 2, right = 44, top = 28, bottom = 6;
  const cols = data.steps.length;
  const order = new Map(data.categories.map((c, i) => [c.id, i]));
  const color = new Map(data.categories.map(c => [c.id, c.color]));
  const name = new Map(data.categories.map(c => [c.id, c.label]));
  const present = data.categories.filter(c => data.steps.some(s => (s[c.id] ?? 0) > 0));
  // each category's slot is as tall as it ever gets, so it sits at one height in every column
  const most = new Map(present.map(c => [c.id, Math.max(...data.steps.map(s => s[c.id] ?? 0))]));
  const max = Math.max([...most.values()].reduce((n, v) => n + v, 0), 1);
  const height = Math.max(300, Math.min(560, 150 + present.length * 44));
  const scale = (height - top - bottom - GAP * (present.length - 1)) / max;
  const x = (k: number) => left + (cols === 1 ? 0 : k * (width - left - right - NODE) / (cols - 1));

  // each column's nodes, every category keeping its slot
  const nodes = data.steps.map((s, k) => {
    let y = top;
    return new Map(present.map(c => {
      const n = s[c.id] ?? 0;
      const node = { id: c.id, n, y, h: n * scale, out: 0, in: 0 };
      y += most.get(c.id)! * scale + GAP;
      return [c.id, node];
    }));
  });

  const svg = root.append('svg')
    .attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img').attr('aria-label', options.label);

  // ribbons, under the nodes
  const ribbons = svg.append('g').attr('class', 'alluvial-ribbons');
  data.links.forEach((list, k) => {
    const from = nodes[k], to = nodes[k + 1];
    if (!from || !to) return;
    const sorted = [...list].filter(l => from.has(l.from) && to.has(l.to))
      .sort((a, b) => order.get(a.from)! - order.get(b.from)! || order.get(a.to)! - order.get(b.to)!);
    // where each ribbon lands in its target, by source order
    const landing = new Map<string, number>();
    for (const l of [...sorted].sort((a, b) => order.get(a.to)! - order.get(b.to)! || order.get(a.from)! - order.get(b.from)!)) {
      const t = to.get(l.to)!;
      landing.set(`${l.from}|${l.to}`, t.y + t.in);
      t.in += l.n * scale;
    }
    for (const l of sorted) {
      const s = from.get(l.from)!;
      const h = l.n * scale;
      const x0 = x(k) + NODE, x1 = x(k + 1), mid = (x0 + x1) / 2;
      const y0 = s.y + s.out, y1 = landing.get(`${l.from}|${l.to}`)!;
      s.out += h;
      ribbons.append('path')
        .attr('d', `M${x0},${y0}C${mid},${y0} ${mid},${y1} ${x1},${y1}L${x1},${y1 + h}C${mid},${y1 + h} ${mid},${y0 + h} ${x0},${y0 + h}Z`)
        .attr('fill', color.get(l.from)!).attr('fill-opacity', l.from === l.to ? 0.3 : 0.5)
        .append('title').text(options.title(k, name.get(l.from)!, name.get(l.to)!, l.n));
    }
  });

  nodes.forEach((column, k) => {
    svg.append('text').attr('class', 'alluvial-head')
      .attr('x', k === 0 && !wide ? x(k) : x(k) + NODE / 2).attr('y', 14)
      .attr('text-anchor', k === 0 && !wide ? 'start' : k === cols - 1 ? 'end' : 'middle')
      .attr('dx', k === cols - 1 ? NODE / 2 : 0)
      .text(data.columns[k] ?? '');
    // names beside the first column, the largest first, wherever a line fits (the key has them all)
    const named: number[] = [];
    if (wide && k === 0) {
      for (const node of [...column.values()].filter(n => n.n).sort((a, b) => b.n - a.n)) {
        const at = node.y + Math.max(Math.min(node.h / 2, 9), 5);
        if (named.some(y => Math.abs(y - at) < 14)) continue;
        named.push(at);
        svg.append('text').attr('class', 'alluvial-label')
          .attr('x', left - 8).attr('y', at).attr('dy', '0.35em').attr('text-anchor', 'end')
          .text(name.get(node.id)!);
      }
    }
    for (const node of column.values()) {
      if (!node.n) continue;
      svg.append('rect').attr('x', x(k)).attr('y', node.y).attr('width', NODE).attr('height', Math.max(node.h, 1))
        .attr('fill', color.get(node.id)!)
        .append('title').text(`${name.get(node.id)}, ${data.columns[k]?.toLowerCase()}: ${node.n.toLocaleString()}`);
      if (node.h >= 11) {
        svg.append('text').attr('class', 'alluvial-count')
          .attr('x', x(k) + NODE + 4).attr('y', node.y + Math.min(node.h / 2, 9)).attr('dy', '0.35em')
          .text(node.n.toLocaleString());
      }
    }
  });
}
