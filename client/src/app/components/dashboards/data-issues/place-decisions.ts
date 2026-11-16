import { downloadTable } from '../../../utils/network-export';

/**
 * Decisions on places that may be one place, kept in this browser: pairs of
 * institution ids (same, different, unsure, and which id to keep) and town or
 * county spellings (which to use, or both right). Both kinds download as one
 * fix list for the data team's pipeline; added to
 * server/data/place-decisions.csv, the decided rows leave everyone's queue.
 * The site itself never changes the data.
 */
export interface PlaceDecision {
  kind: 'pair' | 'spelling';
  a: string;
  b: string;
  column?: string;
  state?: string;
  decision: string;
  keep?: string;
  copy?: string;
  note?: string;
  date: string;
}

const STORE = 'almanacs.placeDecisions';
const REVIEWER = 'almanacs.reviewer';

export class PlaceDecisions {
  all: Record<string, PlaceDecision> = read(STORE, {});
  reviewer: string = read(REVIEWER, '');

  get(key: string): PlaceDecision | null { return this.all[key] ?? null; }

  /** Every decision, both kinds: the fix list is one download. */
  get size(): number { return Object.keys(this.all).length; }

  count(kind: PlaceDecision['kind']): number {
    return Object.values(this.all).filter(d => d.kind === kind).length;
  }

  /** Set a decision; the same one again clears it. */
  set(key: string, d: Omit<PlaceDecision, 'date'>): void {
    if (this.all[key]?.decision === d.decision && this.all[key]?.keep === d.keep) delete this.all[key];
    else this.all[key] = { ...d, date: new Date().toISOString().slice(0, 10) };
    write(STORE, this.all);
  }

  setReviewer(name: string): void {
    this.reviewer = name.trim();
    write(REVIEWER, this.reviewer);
  }

  download(): void {
    const rows = Object.values(this.all).map(d => ({
      kind: d.kind, a: d.a, b: d.b, column: d.column ?? '', state: d.state ?? '', decision: d.decision,
      keep: d.keep ?? '', copy_coordinates: d.copy ?? '', reviewer: this.reviewer, date: d.date, note: d.note ?? '',
    }));
    downloadTable(`place-decisions-${new Date().toISOString().slice(0, 10)}.csv`, rows,
      'Decisions on places that may be one place, from the Catholic Almanacs Data Issues page. Apply the "same" pairs and chosen spellings in the data pipeline; add the rows to server/data/place-decisions.csv to take them out of the review queue');
  }
}

// browser storage can be missing or refuse (private windows): the review still works for the visit
function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
}

function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not kept */ }
}
