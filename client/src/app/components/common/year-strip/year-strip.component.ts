import { Component, Input, OnChanges } from '@angular/core';

interface Cell {
  year?: number;
  on?: boolean;
  gap?: string;   // set on a break: the years it stands for, e.g. "1839–1863"
}

/**
 * A compact strip of every almanac year in the database, filled where this
 * record appears. Runs of years with no data at all (e.g. the Civil War years,
 * or years not yet transcribed) collapse to a narrow hatched break instead of
 * taking up width.
 */
@Component({
  selector: 'app-year-strip',
  imports: [],
  templateUrl: './year-strip.component.html',
  styleUrl: './year-strip.component.scss'
})
export class YearStripComponent implements OnChanges {
  /** Years this record appears in. */
  @Input() years: number[] = [];
  /** Every year present in the database, ascending. */
  @Input() allYears: number[] = [];
  /** Fill colour, usually an entity token such as var(--c-inst). */
  @Input() color = 'var(--c-inst)';

  cells: Cell[] = [];
  label = '';

  ngOnChanges(): void {
    const present = new Set(this.years);
    this.cells = [];
    this.allYears.forEach((year, i) => {
      const prev = this.allYears[i - 1];
      if (prev !== undefined && year - prev > 1) {
        const from = prev + 1, to = year - 1;
        this.cells.push({ gap: from === to ? `${from}` : `${from}–${to}` });
      }
      this.cells.push({ year, on: present.has(year) });
    });
    this.label = 'In the almanacs: ' + this.runs(this.years.filter(y => this.allYears.includes(y))).join(', ');
  }

  /** "1833–1838" style runs over consecutive database years. */
  private runs(years: number[]): string[] {
    const out: string[] = [];
    let start: number | undefined, last: number | undefined;
    for (const y of years) {
      const contiguous = last !== undefined && this.allYears.indexOf(y) === this.allYears.indexOf(last) + 1;
      if (!contiguous) {
        if (start !== undefined) out.push(start === last ? `${start}` : `${start}–${last}`);
        start = y;
      }
      last = y;
    }
    if (start !== undefined) out.push(start === last ? `${start}` : `${start}–${last}`);
    return out;
  }
}
