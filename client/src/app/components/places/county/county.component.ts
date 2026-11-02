import { Component, OnDestroy, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subscription, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { ApiService } from '../../../services/api.service';
import { PageHeaderComponent } from '../../common/page-header/page-header.component';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { CiteComponent } from '../../common/cite/cite.component';
import { institutionLabel, yearRuns } from '../../../utils/record-labels';
import { RECORD_MAP_INKS } from '../../../utils/record-map';

/** GET /api/place/county/:id */
interface CountyPlace {
  county: { id: string; name: string; state: string };
  metro: { id: string; name: string } | null;
  years: { year: number; institutions: number; people: number }[];
  institutions: { inst: string; name: string; type: string; place: string; dioceses: string[]; years: number[]; lat: number | null; lng: number | null }[];
  people: { pers: string; name: string; years: number[]; institutions: string[]; visiting: boolean }[];
  dioceses: { id: string; name: string; years: number[] }[];
  cessions: { number: string; tribes: string; ceded: number; treaty: string; schedule: string; present: string }[];
}

/**
 * A historical county (the Newberry atlas's, as it stood each year) and
 * everything the almanacs recorded there: its institutions, the clergy listed
 * at them, the dioceses they belonged to, and the cessions its land came from.
 */
@Component({
  selector: 'app-county',
  imports: [DecimalPipe, RouterLink, PageHeaderComponent, MapVisComponent, CiteComponent],
  templateUrl: './county.component.html',
  styleUrl: './county.component.scss'
})
export class CountyComponent implements OnInit, OnDestroy {
  readonly crumbs = [{ label: 'Institutions', link: '/institutions' }];
  id = '';
  data: CountyPlace | null = null;
  loading = true;
  notFound = false;
  title = '';
  yearsLabel = '';
  lastYear: number | null = null;
  institutions: (CountyPlace['institutions'][number] & { label: string; span: string })[] = [];
  people: (CountyPlace['people'][number] & { span: string })[] = [];
  cessions: (CountyPlace['cessions'][number] & { date: string })[] = [];
  mapData: any[] = [];
  mapFit: [number, number, number, number] | null = null;
  readonly mapOptions = { mode: 'point' as const, zoom: 7, center: { lat: 39, lng: -90 }, size: { width: '100%', height: 'clamp(280px, 45vh, 440px)' } };
  readonly inks = RECORD_MAP_INKS;
  private sub?: Subscription;

  constructor(private api: ApiService, private route: ActivatedRoute, private titleService: Title) {}

  ngOnInit(): void {
    this.sub = this.route.paramMap.pipe(
      map(p => p.get('id') ?? ''),
      tap(id => { this.id = id; this.loading = true; this.notFound = false; }),
      switchMap(id => this.api.getTypeRequest(`place/county/${encodeURIComponent(id)}`).pipe(catchError(() => of(null)))),
    ).subscribe((res: any) => {
      this.loading = false;
      if (!res) { this.notFound = true; this.data = null; return; }
      this.show(res as CountyPlace);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  yearSpan(years: number[]): string { return yearRuns(years); }

  private show(d: CountyPlace): void {
    this.data = d;
    this.title = `${d.county.name} County, ${d.county.state}`;
    this.titleService.setTitle(`${this.title} · Catholic Almanacs`);
    const years = d.years.map(y => y.year);
    this.yearsLabel = yearRuns(years);
    this.lastYear = years[years.length - 1] ?? null;
    this.institutions = d.institutions.map(i => ({ ...i, label: institutionLabel(i.name, i.type), span: yearRuns(i.years) }));
    this.people = d.people.map(p => ({ ...p, span: yearRuns(p.years) }));
    const date = (n: number) => new Date(Date.UTC(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100))
      .toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    this.cessions = d.cessions.map(c => ({ ...c, date: date(c.ceded) }));
    const placed = d.institutions.filter(i => i.lat != null && i.lng != null);
    this.mapData = placed.map(i => ({
      latitude: i.lat, longitude: i.lng, title: `${institutionLabel(i.name, i.type)} (${yearRuns(i.years)})`,
      internalLink: `/institutions/${i.inst}`, options: { color: RECORD_MAP_INKS.self, radius: 5 },
    }));
    // frame the institutions, with room for the county around them
    if (placed.length) {
      const lats = placed.map(i => i.lat!), lngs = placed.map(i => i.lng!);
      const pad = 0.35;
      this.mapFit = [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad];
    }
  }
}
