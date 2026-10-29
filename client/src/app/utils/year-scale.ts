import * as d3 from 'd3';

/**
 * A time scale for almanac years that gives every year with data an equal
 * slot and collapses each run of missing years (the Civil War, years not yet
 * transcribed) into one narrow break, instead of spending most of the axis on
 * empty space. Call it like a d3 scale: x(1866) is the centre of 1866's slot.
 */
export interface YearScale {
  (year: number): number;
  /** Width of one year's slot, in px. */
  readonly step: number;
  readonly years: number[];
  /** One entry per gap: the missing years and the x of the break's centre. */
  readonly breaks: { from: number; to: number; x: number }[];
  /** Years to label, at least `minSpacing` px apart; each run's first year is preferred. */
  ticks(minSpacing?: number): number[];
}

export function yearScale(years: number[], range: [number, number], breakWidth = 18): YearScale {
  const ys = [...new Set(years)].sort((a, b) => a - b);
  const gapsBefore: number[] = [];
  let gaps = 0;
  ys.forEach((y, i) => {
    if (i > 0 && y - ys[i - 1] > 1) gaps++;
    gapsBefore.push(gaps);
  });
  const [x0, x1] = range;
  const step = ys.length ? (x1 - x0 - gaps * breakWidth) / ys.length : 0;
  const at = (i: number) => x0 + step * (i + 0.5) + gapsBefore[i] * breakWidth;

  const scale = ((year: number): number => {
    if (!ys.length) return x0;
    if (year <= ys[0]) return at(0) - (ys[0] - year) * step;
    if (year >= ys[ys.length - 1]) return at(ys.length - 1) + (year - ys[ys.length - 1]) * step;
    const i = d3.bisectRight(ys, year) - 1;          // ys[i] <= year < ys[i + 1]
    const a = ys[i], b = ys[i + 1];
    if (b - a === 1) return at(i) + (year - a) * step;  // within a run of years
    // Inside a gap: half a slot out of the run, across the break, half a slot in.
    const left = at(i) + step / 2, right = at(i + 1) - step / 2;
    if (year <= a + 0.5) return at(i) + (year - a) * step;
    if (year >= b - 0.5) return at(i + 1) - (b - year) * step;
    return left + ((year - a - 0.5) / (b - a - 1)) * (right - left);
  }) as YearScale;

  const breaks = ys.slice(1)
    .map((y, j) => ({ prev: ys[j], y, i: j + 1 }))
    .filter(({ prev, y }) => y - prev > 1)
    .map(({ prev, y, i }) => ({ from: prev + 1, to: y - 1, x: at(i) - step / 2 - breakWidth / 2 }));

  Object.defineProperties(scale, {
    step: { value: step },
    years: { value: ys },
    breaks: { value: breaks },
  });
  scale.ticks = (minSpacing = 36): number[] => {
    // Prefer each run's first and the overall last year, then every k-th year.
    const k = Math.max(1, Math.ceil(minSpacing / Math.max(step, 1)));
    const starts = new Set(ys.filter((y, i) => i === 0 || y - ys[i - 1] > 1));
    const ranked = [
      ...ys.filter(y => starts.has(y)),
      ys[ys.length - 1],
      ...ys.filter(y => !starts.has(y) && y % k === 0),
    ];
    const chosen: number[] = [];
    for (const y of ranked) {
      if (y === undefined || chosen.includes(y)) continue;
      if (chosen.every(c => Math.abs(scale(c) - scale(y)) >= minSpacing)) chosen.push(y);
    }
    return chosen.sort((a, b) => a - b);
  };
  return scale;
}

/**
 * Draws a bottom year axis for `scale` into `g` at `y = height`, with a
 * zig-zag break mark (and a faint band through the plot) for each gap.
 * Colours come from the theme tokens so it reads in light and dark.
 */
export function drawYearAxis(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  scale: YearScale,
  height: number,
  options: { minSpacing?: number; band?: boolean } = {},
): void {
  const ticks = scale.ticks(options.minSpacing);
  const axis = g.append('g').attr('class', 'year-axis').attr('transform', `translate(0,${height})`);
  const [first, last] = [scale.years[0], scale.years[scale.years.length - 1]];
  if (first === undefined) return;
  const x0 = scale(first) - scale.step / 2, x1 = scale(last) + scale.step / 2;

  // Axis line, interrupted at each break.
  let start = x0;
  for (const b of scale.breaks) {
    axis.append('line').attr('x1', start).attr('x2', b.x - 5).attr('stroke', 'var(--rule)');
    start = b.x + 5;
  }
  axis.append('line').attr('x1', start).attr('x2', x1).attr('stroke', 'var(--rule)');

  for (const t of ticks) {
    const x = scale(t);
    axis.append('line').attr('x1', x).attr('x2', x).attr('y2', 5).attr('stroke', 'var(--rule)');
    axis.append('text')
      .attr('x', x).attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--ink-3)')
      .style('font', '500 11px var(--font-sans)')
      .style('font-variant-numeric', 'tabular-nums')
      .text(t);
  }

  for (const b of scale.breaks) {
    const label = b.from === b.to ? `${b.from}: no almanac data` : `${b.from}–${b.to}: no almanac data`;
    if (options.band !== false) {
      g.insert('rect', ':first-child')
        .attr('x', b.x - 6).attr('width', 12).attr('y', 0).attr('height', height)
        .attr('fill', 'var(--sunk)')
        .append('title').text(label);
    }
    const mark = axis.append('g').attr('transform', `translate(${b.x},0)`);
    mark.append('path')
      .attr('d', 'M-7,5 L-3,-5 M3,5 L7,-5')
      .attr('stroke', 'var(--ink-3)').attr('fill', 'none');
    mark.append('title').text(label);
  }
}
