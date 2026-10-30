import { Component, Input, OnChanges } from '@angular/core';
import { RouterLink } from '@angular/router';

/** A post just before or after a stay (e.g. where a pastor came from). */
export interface LadderPost {
  label: string;
  link: any[] | null;
  query?: Record<string, any>;
}

/** One row: a person at a place, or a place in a career, with the years listed. */
export interface LadderRow {
  key: string;
  label: string;
  link: any[] | null;
  /** 'pers' or 'inst': the record-link colour. */
  kind: 'pers' | 'inst';
  /** Roles, or the place: set small after the name. */
  detail?: string;
  years: number[];
  before?: LadderPost | null;
  after?: LadderPost | null;
}

/**
 * A ladder of service: one row per person (or post), one column per almanac
 * year, the years listed filled in, so succession and overlap read at a
 * glance. Years that aren't consecutive (the 1838–1864 gap) get a marked
 * break; the selected year's column is picked out.
 */
@Component({
  selector: 'app-service-ladder',
  imports: [RouterLink],
  templateUrl: './service-ladder.component.html',
  styleUrl: './service-ladder.component.scss'
})
export class ServiceLadderComponent implements OnChanges {
  @Input() rows: LadderRow[] = [];
  /** The columns: every year to show, ascending. */
  @Input() years: number[] = [];
  @Input() selectedYear: number | null = null;
  /** Accessible name of the table. */
  @Input() caption = '';
  /** Query parameters for every row's link (e.g. keep the selected year). */
  @Input() linkQuery: Record<string, any> | null = null;

  view: (LadderRow & { cells: boolean[]; span: string })[] = [];
  heads: { year: number; label: string; gapBefore: boolean }[] = [];
  columns = '';

  ngOnChanges(): void {
    const years = this.years;
    this.heads = years.map((y, i) => {
      const gapBefore = i > 0 && y - years[i - 1] > 1;
      // full years where a run starts, '34 elsewhere
      return { year: y, label: i === 0 || gapBefore ? String(y) : `’${String(y).slice(2)}`, gapBefore };
    });
    this.columns = `minmax(11rem, 3fr) repeat(${years.length}, minmax(14px, 1fr))`;
    this.view = this.rows.map(r => {
      const sorted = [...r.years].sort((a, b) => a - b);
      const first = sorted[0], last = sorted[sorted.length - 1];
      return { ...r, cells: years.map(y => r.years.includes(y)), span: first === last ? `${first}` : `${first}–${last}` };
    });
  }
}
