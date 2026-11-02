import { Component, OnDestroy, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { SegmentedComponent } from '../../common/segmented/segmented.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { PeopleReviewComponent, ReviewPair } from './people-review/people-review.component';
import { LinkReviewComponent, LinkItem } from './link-review/link-review.component';
import { UrlState } from '../../../utils/url-state';
import { institutionLabel } from '../../../utils/record-labels';
import { citation, downloadTable } from '../../../utils/network-export';

/** GET stats/data-issues (summary) */
interface Summary {
  people: { strong: number; likely: number; possible: number; decided: number; people: number };
  names: number;
  places: { records: number; institutions: number };
  prefixes: number;
  circuits: number;
  territories: number | null;
  counties: number | null;
  links: { open: number; strong: number; linked: number } | null;
  wording: number;
}
interface NameConflict { id: string; name: string; names: { name: string; n: number }[]; years: string; }
interface Unplaced { inst: string; name: string; type: string; place: string; diocese: string; years: number[]; }
interface Prefix { prefix: string; records: number; listedAs: string[]; examples: { inst: string; name: string; type: string; year: number }[]; }
interface LongLink { year: number; miles: number; from: LinkEnd; to: LinkEnd; }
interface LinkEnd { inst: string; name: string; type: string; place: string; lat: number | null; lng: number | null; }
interface TerritoryYear { year: number; placed: number; agree: number; }
interface Unread { inst: string; name: string; type: string; marker: string; word: string; note: string; at: number; years: number[]; }
interface CountyMismatch { inst: string; name: string; type: string; place: string; years: number[]; recorded: string; county: string; state: string; }

const DEFAULTS = { check: 'people', strength: 'strong', show: 'open' };
const PAGE = 50;

/**
 * Data Issues: what in the data to check or correct, one check at a time.
 * People who may be one person (reviewed in app-people-review), ids listed
 * under several surnames, institutions without a place, records outside their
 * diocese's territory, circuits too long to ride, unknown id prefixes, and
 * present-day places for institutions (reviewed in app-link-review).
 */
@Component({
  selector: 'app-data-issues',
  imports: [DecimalPipe, RouterLink, DashboardShellComponent, ControlBarComponent, SegmentedComponent, VizPanelComponent, PeopleReviewComponent, LinkReviewComponent],
  templateUrl: './data-issues.component.html',
  styleUrl: './data-issues.component.scss'
})
export class DataIssuesComponent implements OnInit, OnDestroy {
  readonly related = [
    { label: 'Coverage — the Shape of the Data', link: '/dashboards/coverage' },
    { label: 'Diocese by Diocese', link: '/dashboards/diocese-tracker' },
    { label: 'Mission Circuits', link: '/dashboards/circuits' },
  ];
  readonly strengthOptions = [
    { value: 'strong', label: 'Strong' }, { value: 'likely', label: 'Likely' },
    { value: 'possible', label: 'Possible' }, { value: '', label: 'All' },
  ];
  readonly showOptions = [
    { value: 'open', label: 'To review' }, { value: 'mine', label: 'Decided here' }, { value: 'all', label: 'All' },
  ];

  state = { ...DEFAULTS };
  summary: Summary | null = null;
  checks: { id: string; label: string; count: number | null; note: string }[] = [];
  takeaway = '';
  chips: ControlChip[] = [];
  vizState: VizState = 'loading';
  limit = PAGE;

  pairs: ReviewPair[] = [];
  linkItems: LinkItem[] = [];
  osmBase = '';
  names: NameConflict[] = [];
  unplaced: Unplaced[] = [];
  prefixes: Prefix[] = [];
  longLinks: LongLink[] = [];
  territoryYears: TerritoryYear[] = [];
  countyCheck: { placed: number; agree: number; unrecorded: number } | null = null;
  countyMismatches: CountyMismatch[] = [];
  unread: (Unread & { before: string; match: string; after: string })[] = [];

  private loaded = new Set<string>();
  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];

  constructor(private api: ApiService, router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  ngOnInit(): void {
    this.subs.push(this.api.getTypeRequest('stats/data-issues').subscribe({
      next: (res: any) => { this.summary = res as Summary; this.buildIndex(); },
      error: () => this.buildIndex(),
    }));
    this.subs.push(this.url.changes().subscribe(state => {
      if (state.check !== this.state.check) this.limit = PAGE;
      this.state = state;
      this.chips = (state.check === 'people' || state.check === 'links') && state.strength !== DEFAULTS.strength
        ? [{ label: `Strength: ${this.strengthOptions.find(o => o.value === state.strength)?.label}`, clear: () => this.url.set({ strength: DEFAULTS.strength }) }]
        : [];
      this.load(state.check);
    }));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  setCheck(check: string): void { this.url.set({ check }); }
  setStrength(strength: string): void { this.url.set({ strength }); }
  setShow(show: string): void { this.url.set({ show }); }
  clearAll = (): void => this.url.set({ strength: DEFAULTS.strength, show: DEFAULTS.show });
  more(): void { this.limit += PAGE; }

  label(name: string, type: string): string { return institutionLabel(name, type); }

  spans(years: number[]): string {
    const runs: number[][] = [];
    for (const y of years) {
      const r = runs[runs.length - 1];
      if (r && y === r[r.length - 1] + 1) r.push(y); else runs.push([y]);
    }
    return runs.map(r => r.length > 1 ? `${r[0]}–${String(r[r.length - 1]).slice(2)}` : `${r[0]}`).join(', ');
  }

  coords(e: LinkEnd): string {
    return e.lat == null ? 'no coordinates' : `${Number(e.lat).toFixed(3)}, ${Number(e.lng).toFixed(3)}`;
  }

  private buildIndex(): void {
    const s = this.summary;
    this.checks = [
      { id: 'people', label: 'People who may be one person', count: s ? s.people.strong + s.people.likely + s.people.possible : null,
        note: s ? `${s.people.strong} strong, ${s.people.likely} likely, ${s.people.possible} possible` : '' },
      { id: 'names', label: 'One person id, several surnames', count: s?.names ?? null, note: 'a mistyped id or name' },
      { id: 'places', label: 'Institutions without a place', count: s?.places.institutions ?? null,
        note: s ? `${s.places.records.toLocaleString()} records without coordinates` : '' },
      { id: 'territories', label: 'Outside their diocese’s territory', count: s?.territories ?? null, note: 'records, all years, against the territories drawn' },
      { id: 'counties', label: 'In another county', count: s?.counties ?? null, note: 'the county given is not the county the place lay in that year' },
      { id: 'circuits', label: 'Circuits too long to ride', count: s?.circuits ?? null, note: 'over 500 miles: an end is misplaced' },
      { id: 'wording', label: 'Wording the markers miss', count: s?.wording ?? null,
        note: 'notes about a language, who ran a work or whom it served that the patterns did not read' },
      { id: 'links', label: 'Where they are today', count: s?.links?.open ?? null,
        note: s?.links ? `places to confirm, ${s.links.strong} strong; ${s.links.linked} linked so far` : 'present-day places and websites to confirm' },
      { id: 'prefixes', label: 'Unknown diocese prefixes', count: s?.prefixes ?? null, note: 'records whose id names no diocese in the timeline' },
    ];
    if (s) {
      const open = s.people.strong + s.people.likely + s.people.possible;
      this.takeaway = `${open.toLocaleString()} pairs of person ids may each be one person, ${s.places.institutions.toLocaleString()} institutions have years with no place, and ${s.names} person ids carry more than one surname.`;
    }
  }

  private load(check: string): void {
    if (this.loaded.has(check)) { this.vizState = 'ready'; return; }
    this.vizState = 'loading';
    const done = () => { this.loaded.add(check); this.vizState = 'ready'; };
    const fail = () => this.vizState = 'error';
    if (check === 'territories') {
      this.subs.push(this.api.getTypeRequest('stats/diocese-check').subscribe({
        next: (res: any) => { this.territoryYears = res.years ?? []; done(); },
        error: (e: any) => { this.vizState = e?.status === 404 ? 'empty' : 'error'; },
      }));
      return;
    }
    this.subs.push(this.api.getTypeRequest(`stats/data-issues?check=${check}`).subscribe({
      next: (res: any) => {
        if (check === 'people') this.pairs = res.pairs;
        if (check === 'links') {
          if (!res.available) { this.vizState = 'empty'; return; }
          this.linkItems = res.institutions;
          this.osmBase = res.osmBase ? String(res.osmBase).slice(0, 10) : '';
        }
        if (check === 'names') this.names = res.ids;
        if (check === 'places') this.unplaced = res.institutions;
        if (check === 'prefixes') this.prefixes = res.prefixes;
        if (check === 'circuits') this.longLinks = res.links;
        if (check === 'wording') this.unread = (res.notes as Unread[]).map(n => ({ ...n,
          before: (n.at > 60 ? '…' : '') + n.note.slice(Math.max(0, n.at - 60), n.at),
          match: n.note.slice(n.at, n.at + n.word.length),
          after: n.note.slice(n.at + n.word.length, n.at + n.word.length + 90) + (n.note.length > n.at + n.word.length + 90 ? '…' : '') }));
        if (check === 'counties') {
          if (!res.available) { this.vizState = 'empty'; return; }
          this.countyCheck = { placed: res.placed, agree: res.agree, unrecorded: res.unrecorded };
          this.countyMismatches = res.mismatches;
        }
        done();
      },
      error: fail,
    }));
  }

  retry(): void {
    this.loaded.delete(this.state.check);
    this.load(this.state.check);
  }

  download(): void {
    const note = `Catholic Almanacs data issues: ${this.checks.find(c => c.id === this.state.check)?.label}. ${citation()}`;
    const name = `data-issues-${this.state.check}.csv`;
    switch (this.state.check) {
      case 'names':
        return downloadTable(name, this.names.map(n => ({ person: n.id, name: n.name, years: n.years, listed_as: n.names.map(x => `${x.name} (${x.n})`) })), note);
      case 'places':
        return downloadTable(name, this.unplaced.map(u => ({ institution: u.inst, name: this.label(u.name, u.type), place: u.place, diocese: u.diocese, years: this.spans(u.years) })), note);
      case 'circuits':
        return downloadTable(name, this.longLinks.map(l => ({ year: l.year, miles: l.miles,
          from: l.from.inst, from_name: this.label(l.from.name, l.from.type), from_place: l.from.place, from_lat: l.from.lat, from_lng: l.from.lng,
          to: l.to.inst, to_name: this.label(l.to.name, l.to.type), to_place: l.to.place, to_lat: l.to.lat, to_lng: l.to.lng })), note);
      case 'counties':
        return downloadTable(name, this.countyMismatches.map(c => ({ institution: c.inst, name: this.label(c.name, c.type), place: c.place,
          county_given: c.recorded, county_that_year: c.county, state: c.state, years: this.spans(c.years) })), note);
      case 'wording':
        return downloadTable(name, this.unread.map(u => ({ institution: u.inst, name: this.label(u.name, u.type), marker: u.marker, word: u.word,
          note: u.note, years: this.spans(u.years) })), note);
      case 'prefixes':
        return downloadTable(name, this.prefixes.map(p => ({ prefix: p.prefix, records: p.records, listed_as: p.listedAs, examples: p.examples.map(e => `${e.inst} (${e.year})`) })), note);
    }
  }
}
