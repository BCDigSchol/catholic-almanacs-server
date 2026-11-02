import { Component, Input, OnChanges } from '@angular/core';
import { RouterLink } from '@angular/router';

import { institutionLabel } from '../../../../utils/record-labels';
import { downloadTable } from '../../../../utils/network-export';

/** One side of a pair (GET stats/data-issues?check=people). */
export interface ReviewPerson {
  id: string;
  name: string;
  titles: string[];
  orders: string[];
  years: string;
  career: { inst: string; name: string; type: string; dio: string; from: number; to: number; visiting: boolean }[];
}
export interface ReviewPair {
  key: string;
  score: number;
  strength: 'strong' | 'likely' | 'possible';
  reasons: string[];
  /** Decided in server/data/person-decisions.csv. */
  decision: string | null;
  a: ReviewPerson;
  b: ReviewPerson;
}
export type Decision = 'same' | 'different' | 'unsure';

const STORE = 'almanacs.personDecisions';
const REVIEWER = 'almanacs.reviewer';
const PAGE = 20;

/**
 * Possible duplicate people, two careers side by side, for a reviewer to mark
 * the same person, different people, or unsure. Decisions are kept in this
 * browser and downloaded as a CSV for the data team to commit
 * (server/data/person-decisions.csv), after which they leave everyone's queue.
 */
@Component({
  selector: 'app-people-review',
  imports: [RouterLink],
  templateUrl: './people-review.component.html',
  styleUrl: './people-review.component.scss'
})
export class PeopleReviewComponent implements OnChanges {
  @Input() pairs: ReviewPair[] = [];
  /** strong | likely | possible | '' (all). */
  @Input() strength = '';
  /** open: not yet decided anywhere; mine: decided in this browser; all. */
  @Input() show = 'open';

  shown: (ReviewPair & { mine: Decision | null })[] = [];
  matching = 0;
  limit = PAGE;
  mine: Record<string, { decision: Decision; date: string }> = {};
  reviewer = '';

  constructor() {
    this.mine = this.read(STORE, {});
    this.reviewer = this.read(REVIEWER, '');
  }

  ngOnChanges(): void {
    this.limit = PAGE;
    this.refresh();
  }

  get decidedHere(): number { return Object.keys(this.mine).length; }

  decide(pair: ReviewPair, decision: Decision): void {
    if (this.mine[pair.key]?.decision === decision) delete this.mine[pair.key];
    else this.mine[pair.key] = { decision, date: new Date().toISOString().slice(0, 10) };
    this.write(STORE, this.mine);
    // stay put: the pair keeps its place until the filter is changed
    this.shown = this.shown.map(p => p.key === pair.key ? { ...p, mine: this.mine[pair.key]?.decision ?? null } : p);
  }

  setReviewer(name: string): void {
    this.reviewer = name.trim();
    this.write(REVIEWER, this.reviewer);
  }

  more(): void {
    this.limit += PAGE;
    this.refresh();
  }

  label(name: string, type: string): string { return institutionLabel(name, type); }

  span(from: number, to: number): string {
    return from === to ? `${from}` : `${from}–${String(to).slice(2)}`;
  }

  download(): void {
    const byKey = new Map(this.pairs.map(p => [p.key, p]));
    const rows = Object.entries(this.mine).map(([key, d]) => {
      const p = byKey.get(key);
      const [a, b] = key.split('|');
      return { a, b, decision: d.decision, reviewer: this.reviewer, date: d.date,
        note: p ? `${p.a.name} (${p.a.years}) / ${p.b.name} (${p.b.years})` : '' };
    });
    downloadTable(`person-decisions-${new Date().toISOString().slice(0, 10)}.csv`, rows,
      'Decisions on possible duplicate people from the Catholic Almanacs Data Issues page; add the rows to server/data/person-decisions.csv');
  }

  private refresh(): void {
    const all = this.pairs
      .filter(p => !this.strength || p.strength === this.strength)
      .map(p => ({ ...p, mine: this.mine[p.key]?.decision ?? null }))
      .filter(p => this.show === 'all' ? true : this.show === 'mine' ? !!p.mine : !p.decision && !p.mine);
    this.matching = all.length;
    this.shown = all.slice(0, this.limit);
  }

  // browser storage can be missing or refuse (private windows): the review still works for the visit
  private read<T>(key: string, fallback: T): T {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
  }

  private write(key: string, value: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not kept */ }
  }
}
