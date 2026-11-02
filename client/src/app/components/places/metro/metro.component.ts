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

interface County { id: string; name: string; state: string; }
/** GET /api/place/metro/:id */
interface MetroPlace {
  metro: { id: string; name: string; state: string; also: string[]; lat: number; lng: number; populations: Record<string, number | null> };
  counties: (County & { institutions: number })[];
  others: { id: string; name: string; state: string }[];
  years: { year: number; institutions: number; people: number }[];
  institutions: { inst: string; name: string; type: string; place: string; dioceses: string[]; years: number[]; lat: number | null; lng: number | null; county: County | null }[];
  people: { pers: string; name: string; years: number[]; institutions: string[]; visiting: boolean }[];
  dioceses: { id: string; name: string; years: number[] }[];
  cessions: { number: string; tribes: string; ceded: number; treaty: string; schedule: string; present: string }[];
}

/**
 * A metro area: a city of 50,000 or more in 1870 and the counties around it
 * (server/data/metros.csv), and everything the almanacs recorded in those
 * counties. The boundary is drawn for this site, not the period's, and the
 * page says so before anything else.
 */
@Component({
  selector: 'app-metro',
  imports: [DecimalPipe, RouterLink, PageHeaderComponent, MapVisComponent, CiteComponent],
  templateUrl: './metro.component.html',
  styleUrl: './metro.component.scss'
})
export class MetroComponent implements OnInit, OnDestroy {
  readonly crumbs = [{ label: 'Institutions', link: '/institutions' }];
  id = '';
  data: MetroPlace | null = null;
  notFound = false;
  title = '';
  yearsLabel = '';
  lastYear: number | null = null;
  countyIds: string[] = [];
  populations: { year: string; n: number }[] = [];
  institutions: (MetroPlace['institutions'][number] & { label: string; span: string })[] = [];
  people: (MetroPlace['people'][number] & { span: string })[] = [];
  cessions: (MetroPlace['cessions'][number] & { date: string })[] = [];
  mapData: any[] = [];
  mapFit: [number, number, number, number] | null = null;
  readonly mapOptions = { mode: 'point' as const, zoom: 8, center: { lat: 39, lng: -90 }, size: { width: '100%', height: 'clamp(300px, 50vh, 500px)' } };
  private sub?: Subscription;

  constructor(private api: ApiService, private route: ActivatedRoute, private titleService: Title) {}

  ngOnInit(): void {
    this.sub = this.route.paramMap.pipe(
      map(p => p.get('id') ?? ''),
      tap(id => { this.id = id; this.notFound = false; this.data = null; }),
      switchMap(id => this.api.getTypeRequest(`place/metro/${encodeURIComponent(id)}`).pipe(catchError(() => of(null)))),
    ).subscribe((res: any) => {
      if (!res) { this.notFound = true; return; }
      this.show(res as MetroPlace);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  yearSpan(years: number[]): string { return yearRuns(years); }

  private show(d: MetroPlace): void {
    this.data = d;
    this.title = `Greater ${d.metro.name}`;
    this.titleService.setTitle(`${this.title} · Catholic Almanacs`);
    const years = d.years.map(y => y.year);
    this.yearsLabel = yearRuns(years);
    this.lastYear = years[years.length - 1] ?? null;
    this.countyIds = d.counties.map(c => c.id);
    this.populations = Object.entries(d.metro.populations).filter(([, n]) => n != null).map(([year, n]) => ({ year, n: n! }));
    this.institutions = d.institutions.map(i => ({ ...i, label: institutionLabel(i.name, i.type), span: yearRuns(i.years) }));
    this.people = d.people.map(p => ({ ...p, span: yearRuns(p.years) }));
    const date = (n: number) => new Date(Date.UTC(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100))
      .toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    this.cessions = d.cessions.map(c => ({ ...c, date: date(c.ceded) }));
    const placed = d.institutions.filter(i => i.lat != null && i.lng != null);
    this.mapData = placed.map(i => ({
      latitude: i.lat, longitude: i.lng,
      title: `${institutionLabel(i.name, i.type)} (${yearRuns(i.years)})${i.county ? ', ' + i.county.name + ' County' : ''}`,
      internalLink: `/institutions/${i.inst}`, options: { color: RECORD_MAP_INKS.self, radius: 4 },
    }));
    // frame the institutions, with a little room around them
    if (placed.length) {
      const lats = placed.map(i => i.lat!), lngs = placed.map(i => i.lng!);
      const pad = 0.15;
      this.mapFit = [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad];
    }
  }
}
