import * as d3 from 'd3';

import { yearScale, drawYearAxis } from './year-scale';

/** One year's bar: its parts bottom to top, and the total a share is taken of. */
export interface StackedYear {
  year: number;
  total: number;
  parts: { id: string; n: number }[];
}

export interface StackedYearsOptions {
  /** Each part's ink. */
  inks: Record<string, string>;
  /** Each part's name, for the hover titles. */
  labels: Record<string, string>;
  /** Shares of each year's total instead of counts. */
  share?: boolean;
  /** The year picked out with a rubric outline. */
  selected?: number | null;
  /** Clicking a year's bar. */
  onYear?: (year: number) => void;
  ariaLabel: string;
  height?: number;
}

/**
 * Stacked bars, one per year, on the almanac year axis (gaps collapsed and
 * marked), drawn into `host` at its width. Returns the width drawn at, so a
 * ResizeObserver can tell when to draw again.
 */
export function drawStackedYears(host: HTMLElement, rows: StackedYear[], o: StackedYearsOptions): number {
  d3.select(host).selectAll('*').remove();
  const width = host.clientWidth;
  if (!width || !rows.length) return width;
  const m = { top: 10, right: 12, bottom: 30, left: 44 };
  const height = o.height ?? 220, innerW = width - m.left - m.right, innerH = height - m.top - m.bottom;
  const svg = d3.select(host).append('svg').attr('width', width).attr('height', height).attr('role', 'img').attr('aria-label', o.ariaLabel);
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
  const x = yearScale(rows.map(r => r.year), [0, innerW]);
  const y = d3.scaleLinear().domain([0, o.share ? 1 : d3.max(rows, r => r.total) || 1]).nice(4).range([innerH, 0]);
  g.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(o.share ? d3.format('.0%') : d3.format(',d')).tickSize(-innerW).tickPadding(6))
    .call(s => s.select('.domain').remove()).call(s => s.selectAll('.tick line').attr('class', 'gridline'));
  drawYearAxis(g, x, innerH, { minSpacing: 34 });
  const bw = Math.max(5, Math.min(30, x.step * 0.65));
  for (const r of rows) {
    let acc = 0;
    const bar = g.append('g');
    if (o.onYear) bar.style('cursor', 'pointer').on('click', () => o.onYear!(r.year));
    for (const p of r.parts) {
      if (!p.n) continue;
      const v0 = o.share ? acc / (r.total || 1) : acc, v1 = o.share ? (acc + p.n) / (r.total || 1) : acc + p.n;
      acc += p.n;
      bar.append('rect').attr('x', x(r.year) - bw / 2).attr('width', bw).attr('y', y(v1)).attr('height', Math.max(0, y(v0) - y(v1)))
        .attr('fill', o.inks[p.id]).append('title')
        .text(`${r.year}: ${p.n.toLocaleString()} ${(o.labels[p.id] ?? p.id).toLowerCase()}${r.total ? ` (${Math.round(100 * p.n / r.total)}%)` : ''}`);
    }
    if (r.year === o.selected) {
      const top = o.share ? 1 : r.total;
      g.append('rect').attr('x', x(r.year) - bw / 2 - 2).attr('width', bw + 4).attr('y', y(top) - 2).attr('height', innerH - y(top) + 4)
        .attr('fill', 'none').attr('stroke', 'var(--rubric)').attr('stroke-width', 1.5).attr('pointer-events', 'none');
    }
  }
  return width;
}
