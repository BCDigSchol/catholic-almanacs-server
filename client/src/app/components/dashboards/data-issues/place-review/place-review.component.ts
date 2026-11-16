import { Component, Input, OnChanges } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ServiceLadderComponent, LadderRow } from '../../../common/service-ladder/service-ladder.component';
import { institutionLabel } from '../../../../utils/record-labels';
import { PlaceDecisions } from '../place-decisions';

/** One side of a pair (GET stats/data-issues?check=same-places). */
export interface PlaceSide {
  id: string;
  name: string;
  type: string;
  place: string;
  state: string;
  dio: string;
  /** Its family: a root id with its children and linked siblings (never paired with each other). */
  family: string;
  town: string;
  names: string[];
  years: number[];
  placedYears: number[];
  /** Years without coordinates. */
  unplaced: number[];
  /** Per unplaced year, the other id's nearest placed year. */
  fills: { year: number; from: number; lat: number; lng: number }[];
}
export interface PlacePair {
  key: string;
  score: number;
  /** renamed: named differently, with clues that something carried over; judged by a person, not ranked. */
  strength: 'strong' | 'likely' | 'possible' | 'renamed';
  reasons: string[];
  /** Named differently: the two names, for the reviewer to judge renamed or replaced. */
  rename: { from: string; to: string } | null;
  /** Decided in server/data/place-decisions.csv. */
  decision: string | null;
  a: PlaceSide;
  b: PlaceSide;
}
/** Every institution id, compact: [id, name, type, town, state, dio, years as a bit per almanac year, family, depth]. */
export interface PlaceIndex {
  fields: string[];
  rows: [string, string, string, string, string, string, number, string, number][];
}
type Row = PlaceIndex['rows'][number];
type View = 'town' | 'diocese';
interface Shown extends PlacePair {
  mine: string | null;
  keep: string;
  view: View;
  ladder: LadderRow[];
  hidden: number;
}

const PAGE = 20;
const GENERIC = new Set(['saint', 'church', 'chapel', 'school', 'academy', 'college', 'institution', 'unnamed', 'asylum',
  'orphan', 'female', 'male', 'young', 'ladies', 'parish', 'free', 'select', 'boys', 'girls', 'convent', 'house', 'hospital',
  'sisters', 'brothers', 'seminary', 'cathedral', 'parochial', 'boarding', 'station', 'mission', 'blessed', 'virgin']);
/** The words of a name that say whom it's named for. */
const nameWords = (name: string) => (name || '').toLowerCase().replace(/'s\b/g, '').split(/[^a-z]+/)
  .filter(w => w.length > 3 && !GENERIC.has(w));
const TOWN_ROWS = 14;
const DIOCESE_ROWS = 200;

/**
 * Institution ids that may be one institution, side by side, each pair over
 * the years its town (or diocese) had institutions listed, the two ids in
 * rubric, so the handover or the gap shows. A reviewer marks the same place
 * (and which id to keep), different places, or unsure; the decisions download
 * as a fix list for the data pipeline, with the coordinates each id could
 * take from the other.
 */
@Component({
  selector: 'app-place-review',
  imports: [RouterLink, ServiceLadderComponent],
  templateUrl: './place-review.component.html',
  styleUrl: './place-review.component.scss'
})
export class PlaceReviewComponent implements OnChanges {
  @Input() pairs: PlacePair[] = [];
  @Input() institutions: PlaceIndex | null = null;
  /** Every almanac year, ascending: the ladder's columns. */
  @Input() years: number[] = [];
  /** strong | likely | possible | '' (all). */
  @Input() strength = '';
  /** open: not yet decided anywhere; mine: decided in this browser; all. */
  @Input() show = 'open';
  /** The pairs named differently: a note that a person judges each. */
  @Input() renamed = false;

  decisions = new PlaceDecisions();
  shown: Shown[] = [];
  matching = 0;
  limit = PAGE;
  private byTown = new Map<string, Row[]>();
  private byDio = new Map<string, Row[]>();
  private byFamily = new Map<string, Row[]>();

  ngOnChanges(): void {
    this.limit = PAGE;
    this.index();
    this.refresh();
  }

  get decidedHere(): number { return this.decisions.count('pair'); }

  decide(p: Shown, decision: string, keep = p.keep): void {
    const merged = keep === p.a.id ? p.b.id : p.a.id;
    this.decisions.set(p.key, {
      kind: 'pair', a: p.a.id, b: p.b.id, decision,
      keep: decision === 'same' ? keep : '',
      copy: decision === 'same' ? this.copyText(p) : '',
      note: decision === 'same' ? `merge ${merged} into ${keep}` : `${this.label(p.a.name, p.a.type)} / ${this.label(p.b.name, p.b.type)}`,
    });
    const d = this.decisions.get(p.key);
    // stay put: the pair keeps its place until the filter is changed
    p.mine = d?.decision ?? null;
    p.keep = d?.keep || keep;
  }

  /** Swap which id is kept; a "same" decision is kept with the new choice. */
  setKeep(p: Shown, keep: string): void {
    if (p.mine === 'same') this.decide(p, 'same', keep);
    else p.keep = keep;
  }

  setView(p: Shown, view: View): void {
    p.view = view;
    this.buildLadder(p);
  }

  setReviewer(name: string): void { this.decisions.setReviewer(name); }
  download(): void { this.decisions.download(); }

  more(): void {
    this.limit += PAGE;
    this.refresh();
  }

  label(name: string, type: string): string { return institutionLabel(name, type); }

  spans(years: number[]): string {
    const all = this.years;
    const runs: number[][] = [];
    for (const y of years) {
      const r = runs[runs.length - 1];
      // consecutive almanac years run together (1861 then 1864 is one run)
      if (r && all.indexOf(y) === all.indexOf(r[r.length - 1]) + 1 && y - r[r.length - 1] < 4) r.push(y); else runs.push([y]);
    }
    return runs.map(r => r.length > 1 ? `${r[0]}–${String(r[r.length - 1]).slice(2)}` : `${r[0]}`).join(', ');
  }

  private copyText(p: PlacePair): string {
    const line = (to: PlaceSide, from: PlaceSide) => to.fills.map(f => `${to.id} ${f.year} ← ${from.id} ${f.from} (${f.lat}, ${f.lng})`);
    return [...line(p.a, p.b), ...line(p.b, p.a)].join('; ');
  }

  /** The id to keep by default: the one that is not an 1830s .9xxx id, else the longer-listed. */
  private suggestedKeep(p: PlacePair): string {
    const nine = (s: PlaceSide) => /\.9\d{3}/.test(s.id);
    if (nine(p.a) !== nine(p.b)) return nine(p.a) ? p.b.id : p.a.id;
    return p.a.years.length > p.b.years.length ? p.a.id : p.b.id;
  }

  private index(): void {
    this.byTown.clear();
    this.byDio.clear();
    this.byFamily.clear();
    const add = (m: Map<string, Row[]>, k: string, r: Row) => (m.get(k) ?? m.set(k, []).get(k)!).push(r);
    for (const r of this.institutions?.rows ?? []) {
      const [, , , town, , dio, , family] = r;
      if (town) add(this.byTown, town, r);
      if (dio) add(this.byDio, dio, r);
      if (family) add(this.byFamily, family, r);
    }
  }

  private refresh(): void {
    const all = this.pairs
      .filter(p => !this.strength || p.strength === this.strength)
      .map(p => ({ p, mine: this.decisions.get(p.key) }))
      .filter(({ p, mine }) => this.show === 'all' ? true : this.show === 'mine' ? !!mine : !p.decision && !mine);
    this.matching = all.length;
    this.shown = all.slice(0, this.limit).map(({ p, mine }) => {
      const s: Shown = { ...p, mine: mine?.decision ?? null, keep: mine?.keep || this.suggestedKeep(p), view: 'town', ladder: [], hidden: 0 };
      this.buildLadder(s);
      return s;
    });
  }

  /**
   * The pair's two families (each id with its parent, children and siblings,
   * as on record pages), then the town's other families (or its dioceses'):
   * a family's rows together, root first and children indented under it.
   */
  private buildLadder(p: Shown): void {
    const ids = new Set([p.a.id, p.b.id]);
    const state = p.a.state || p.b.state;
    const fams = [...new Set([p.a.family, p.b.family])];
    // the same state only: Louisville, Kentucky is not Louisville, Georgia
    const pool = (p.view === 'town'
      ? [...(this.byTown.get(p.a.town) ?? []), ...(p.b.town !== p.a.town ? this.byTown.get(p.b.town) ?? [] : [])]
      : [...(this.byDio.get(p.a.dio) ?? []), ...(p.b.dio !== p.a.dio ? this.byDio.get(p.b.dio) ?? [] : [])])
      .filter(r => !fams.includes(r[7]) && (!r[4] || !state || r[4] === state));
    const entry = (r: Row) => ({ r, years: this.decode(r[6]) });
    const familyRows = (rs: Row[]) => [...new Map(rs.map(r => [r[0], r])).values()].map(entry)
      // by id: a root sorts before its _NN children, and they before their .NN children
      .sort((x, y) => x.r[0] < y.r[0] ? -1 : x.r[0] > y.r[0] ? 1 : 0);

    // the pair's families, the earlier one first
    const pairRows = fams.flatMap(f => familyRows(this.byFamily.get(f) ?? []));

    // the rest, a family at a time; in a town, families named like the pair first, so a third id for the same place shows up
    const words = new Set([...p.a.names, ...p.b.names, p.a.name, p.b.name].flatMap(nameWords));
    const groups = new Map<string, Row[]>();
    for (const r of pool) (groups.get(r[7]) ?? groups.set(r[7], []).get(r[7])!).push(r);
    const families = [...groups.values()].map(rs => {
      const rows = familyRows(rs);
      return { rows, like: rows.some(x => nameWords(x.r[1]).some(w => words.has(w))) ? 0 : 1,
        first: Math.min(...rows.map(x => x.years[0] ?? 9999)), town: rows[0]?.r[3] || '~' };
    }).sort((x, y) => p.view === 'diocese'
      ? x.town.localeCompare(y.town) || x.first - y.first
      : x.like - y.like || x.first - y.first);
    const others = families.flatMap(f => f.rows);
    const cap = p.view === 'town' ? TOWN_ROWS : DIOCESE_ROWS;
    p.hidden = Math.max(0, others.length - cap);

    const town = (t: string) => t.replace(/\b\w/g, c => c.toUpperCase());
    p.ladder = [...pairRows, ...others.slice(0, cap)].map(({ r, years }) => ({
      key: r[0], label: this.label(r[1], r[2]), link: ['/institutions', r[0]], kind: 'inst' as const,
      detail: p.view === 'diocese' && r[3] && r[8] === 0 ? `${r[0]} · ${town(r[3])}` : r[0],
      years, mark: ids.has(r[0]), depth: r[8],
    }));
  }

  private decode(mask: number): number[] {
    return this.years.filter((_, k) => Math.floor(mask / 2 ** k) % 2 === 1);
  }
}
