import { ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { Settings } from '../../../../app.settings';
import { institutionLabel, personLabel, placeLabel, yearRuns } from '../../../../utils/record-labels';

interface CardView {
  kind: 'institution' | 'person';
  name: string;
  detail: string;
  years: string;
  link: string;
}

/**
 * `<almanac-record record="alb.ny.0001" year="1850">`: a live card for an
 * institution or person, for content pages. Shows the record's name as of
 * the year given (else its latest), where it was, and its years, linking to
 * the record page. Person ids are told from institution ids by their shape.
 */
@Component({
  selector: 'app-record-card',
  imports: [],
  templateUrl: './record-card.component.html',
  styleUrl: './record-card.component.scss'
})
export class RecordCardComponent implements OnChanges {
  @Input() record = '';
  @Input() year: string | number = '';
  /** "institution" or "person"; guessed from the id when not given. */
  @Input() kind = '';

  view: CardView | null = null;
  missing = false;

  constructor(private http: HttpClient, private router: Router, private cd: ChangeDetectorRef) {}

  private pending = false;
  private request = 0;

  /** Attributes arrive one at a time, so the load waits for the whole set. */
  ngOnChanges(): void {
    if (this.pending) return;
    this.pending = true;
    Promise.resolve().then(() => { this.pending = false; this.load(); });
  }

  private load(): void {
    this.view = null;
    this.missing = false;
    const id = (this.record || '').trim();
    if (!id) return;
    const kind = this.kind === 'person' || (this.kind !== 'institution' && !/^[a-z]+\.[a-z]{2}\.\d+/i.test(id)) ? 'person' : 'institution';
    const base = Settings.apiUrl.replace(/\/$/, '');
    const seq = ++this.request;
    this.http.get<any>(`${base}/${kind}/${encodeURIComponent(id)}`).subscribe({
      next: data => {
        if (seq !== this.request) return;
        this.view = kind === 'institution' ? this.institution(id, data) : this.person(id, data);
        this.cd.markForCheck();
      },
      error: () => { if (seq === this.request) { this.missing = true; this.cd.markForCheck(); } },
    });
  }

  private get yearNumber(): number | null {
    const y = Number(this.year);
    return y > 0 ? y : null;
  }

  private institution(id: string, d: any): CardView {
    const years: number[] = d.year ?? [];
    const dioceses: string[] = d.diocese ?? [];
    return {
      kind: 'institution',
      name: institutionLabel(d.instName, d.instType),
      detail: [d.instType, placeLabel(d.cityReg || d.cityOrig, d.stateOrig || d.stateReg), dioceses.length ? `Diocese of ${dioceses[dioceses.length - 1]}` : '']
        .filter(Boolean).join(' · '),
      years: yearRuns(years),
      link: `/institution/${id}${this.yearNumber ? `?year=${this.yearNumber}` : ''}`,
    };
  }

  private person(id: string, d: any): CardView {
    const posts: any[] = d.residingInstitutions ?? [];
    const names: string[] = Array.isArray(d.name) ? d.name : [d.name];
    const inYear = this.yearNumber ? posts.find(p => p.year === this.yearNumber) : null;
    const latest = posts.reduce((a, b) => (!a || b.year > a.year ? b : a), null as any);
    const post = inYear ?? latest;
    return {
      kind: 'person',
      name: personLabel({ title: d.title, name: names[0], suffix: d.suffix }),
      detail: post ? [post.instName, placeLabel(post.cityReg, ''), post.diocese ? `Diocese of ${post.diocese}` : ''].filter(Boolean).join(' · ') : '',
      years: yearRuns(posts.map(p => p.year)),
      link: `/person/${id}${this.yearNumber ? `?year=${this.yearNumber}` : ''}`,
    };
  }

  open(event: Event): void {
    if (!this.view) return;
    event.preventDefault();
    this.router.navigateByUrl(this.view.link);
  }
}
