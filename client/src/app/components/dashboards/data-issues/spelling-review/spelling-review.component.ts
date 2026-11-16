import { Component, Input, OnChanges } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PlaceDecisions } from '../place-decisions';

/** One spelling of a town or county (GET stats/data-issues?check=spellings). */
export interface SpellingSide { value: string; records: number; institutions: string[]; }
export interface Spelling {
  key: string;
  column: 'city' | 'county';
  state: string;
  /** Between the two spellings' points, where both have them. */
  miles: number | null;
  sharedCounty: boolean;
  /** Decided in server/data/place-decisions.csv. */
  decision: string | null;
  /** a is the more common spelling. */
  a: SpellingSide;
  b: SpellingSide;
}
interface Shown extends Spelling { mine: string | null; open: boolean; }

const INSTS_SHOWN = 6;

/**
 * Town and county names spelt two ways in the standardised columns, within a
 * state and lying together. A reviewer picks the spelling to use, or says
 * both are right; the decisions join the places fix list.
 */
@Component({
  selector: 'app-spelling-review',
  imports: [RouterLink],
  templateUrl: './spelling-review.component.html',
  styleUrl: './spelling-review.component.scss'
})
export class SpellingReviewComponent implements OnChanges {
  @Input() spellings: Spelling[] = [];
  /** open: not yet decided anywhere; mine: decided in this browser; all. */
  @Input() show = 'open';

  readonly instsShown = INSTS_SHOWN;
  decisions = new PlaceDecisions();
  shown: Shown[] = [];

  ngOnChanges(): void {
    this.shown = this.spellings
      .map(s => ({ ...s, mine: this.decisions.get(s.key)?.decision ?? null, open: false }))
      .filter(s => this.show === 'all' ? true : this.show === 'mine' ? !!s.mine : !s.decision && !s.mine);
  }

  get decidedHere(): number { return this.decisions.count('spelling'); }

  decide(s: Shown, decision: 'a' | 'b' | 'both'): void {
    const keep = decision === 'a' ? s.a.value : decision === 'b' ? s.b.value : '';
    const change = decision === 'a' ? s.b : decision === 'b' ? s.a : null;
    this.decisions.set(s.key, {
      kind: 'spelling', a: s.a.value, b: s.b.value, column: s.column, state: s.state, decision, keep,
      note: change ? `${s.column}_reg "${change.value}" → "${keep}" in ${change.institutions.join(' ')}` : 'both spellings are right',
    });
    s.mine = this.decisions.get(s.key)?.decision ?? null;
  }

  setReviewer(name: string): void { this.decisions.setReviewer(name); }
  download(): void { this.decisions.download(); }

  where(s: Spelling): string {
    const parts = [];
    if (s.sharedCounty) parts.push('in the same county');
    if (s.miles != null) parts.push(s.miles < 0.5 ? 'placed at the same spot' : `placed ${s.miles} miles apart`);
    return parts.join(', ');
  }
}
