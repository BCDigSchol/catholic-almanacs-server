import { Component, Input, OnChanges } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { institutionLabel, isUnnamed, yearSpan } from '../../../../utils/record-labels';
import { downloadTable } from '../../../../utils/network-export';

/** A present-day place suggested for an institution (tiles/record-links.py). */
export interface LinkCandidate {
  osm: string;
  osmUrl: string;
  name: string;
  kind: 'worship' | 'school' | 'college' | 'hospital' | 'convent';
  km: number;
  score: number;
  strength: 'strong' | 'likely' | 'possible';
  /** "not given": matched on the name alone, may be another church's. */
  denomination?: string;
  website?: string;
  wikipediaUrl?: string | null;
  start?: string;
}
/** One institution and its suggestions (GET stats/data-issues?check=links). */
export interface LinkItem {
  inst: string;
  name: string;
  type: string;
  place: string;
  years: number[];
  names: string[];
  strength: 'strong' | 'likely' | 'possible';
  score: number;
  candidates: LinkCandidate[];
  /** Decided in server/data/institution-links.csv. */
  decision: { decision: string; osm: string; url: string } | null;
}
type Mine = { decision: 'linked' | 'none' | 'unsure'; osm: string; url: string; name: string; date: string };

const STORE = 'almanacs.linkDecisions';
const REVIEWER = 'almanacs.reviewer';
const PAGE = 20;
const KINDS: Record<string, string> = { worship: 'church', school: 'school', college: 'college', hospital: 'hospital', convent: 'convent' };

/**
 * Present-day places for institutions, for a reviewer to confirm: each
 * institution beside the OpenStreetMap churches, schools and hospitals near it
 * that share its dedication. Pick the one that is the same institution today
 * (its website comes with it), give a link of your own, or say none of them.
 * Decisions are kept in this browser and downloaded as a CSV for the data team
 * to commit (server/data/institution-links.csv); linked institutions then show
 * the links on their record pages.
 */
@Component({
  selector: 'app-link-review',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './link-review.component.html',
  styleUrl: './link-review.component.scss'
})
export class LinkReviewComponent implements OnChanges {
  @Input() items: LinkItem[] = [];
  /** strong | likely | possible | '' (all). */
  @Input() strength = '';
  /** open: not yet decided anywhere; mine: decided in this browser; all. */
  @Input() show = 'open';

  shown: (LinkItem & { mine: Mine | null; others: string[] })[] = [];
  matching = 0;
  limit = PAGE;
  mine: Record<string, Mine> = {};
  reviewer = '';
  readonly kinds = KINDS;

  constructor() {
    this.mine = this.read(STORE, {});
    this.reviewer = this.read(REVIEWER, '');
  }

  ngOnChanges(): void {
    this.limit = PAGE;
    this.refresh();
  }

  get decidedHere(): number { return Object.keys(this.mine).length; }

  /** This candidate is the institution today (clicking again undoes it). */
  pick(item: LinkItem, c: LinkCandidate): void {
    const cur = this.mine[item.inst];
    if (cur?.decision === 'linked' && cur.osm === c.osm) return this.set(item, null);
    this.set(item, { decision: 'linked', osm: c.osm, url: c.website ?? '', name: c.name });
  }

  /** A link the reviewer found themselves (a parish website, a history page). */
  addUrl(item: LinkItem, url: string): void {
    url = url.trim();
    const cur = this.mine[item.inst];
    if (!url) {
      if (cur?.decision === 'linked' && !cur.osm) this.set(item, null);
      return;
    }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const chosen = cur?.decision === 'linked' ? cur : null;
    this.set(item, { decision: 'linked', osm: chosen?.osm ?? '', url, name: chosen?.name ?? '' });
  }

  mark(item: LinkItem, decision: 'none' | 'unsure'): void {
    this.set(item, this.mine[item.inst]?.decision === decision ? null : { decision, osm: '', url: '', name: '' });
  }

  setReviewer(name: string): void {
    this.reviewer = name.trim();
    this.write(REVIEWER, this.reviewer);
  }

  more(): void {
    this.limit += PAGE;
    this.refresh();
  }

  /** A link the reviewer typed, as opposed to the chosen place's own website. */
  ownUrl(i: LinkItem & { mine: Mine | null }): string {
    const m = i.mine;
    if (m?.decision !== 'linked' || !m.url) return '';
    return m.url === i.candidates.find(c => c.osm === m.osm)?.website ? '' : m.url;
  }

  label(name: string, type: string): string { return institutionLabel(name, type); }
  span(years: number[]): string { return yearSpan(years); }
  host(url: string): string { try { return new URL(url).host.replace(/^www\./, ''); } catch { return url; } }

  download(): void {
    const rows = Object.entries(this.mine).map(([inst, d]) => ({
      inst, decision: d.decision, osm: d.osm, url: d.url, reviewer: this.reviewer, date: d.date, note: d.name,
    }));
    downloadTable(`institution-links-${new Date().toISOString().slice(0, 10)}.csv`, rows,
      'Present-day places for institutions from the Catholic Almanacs Data Issues page; add the rows to server/data/institution-links.csv');
  }

  private set(item: LinkItem, d: Omit<Mine, 'date'> | null): void {
    if (d) this.mine[item.inst] = { ...d, date: new Date().toISOString().slice(0, 10) };
    else delete this.mine[item.inst];
    this.write(STORE, this.mine);
    // stay put: the institution keeps its place until the filter is changed
    this.shown = this.shown.map(i => i.inst === item.inst ? { ...i, mine: this.mine[item.inst] ?? null } : i);
  }

  private refresh(): void {
    const all = this.items
      .filter(i => !this.strength || i.strength === this.strength)
      .map(i => ({ ...i, mine: this.mine[i.inst] ?? null, others: i.names.filter(n => n !== i.name && !isUnnamed(n)) }))
      .filter(i => this.show === 'all' ? true : this.show === 'mine' ? !!i.mine : !i.decision && !i.mine);
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
