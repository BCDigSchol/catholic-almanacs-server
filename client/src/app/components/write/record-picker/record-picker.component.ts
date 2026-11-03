import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { ApiService } from '../../../services/api.service';

export interface RecordPick {
  kind: 'institution' | 'person' | 'county';
  id: string;
  name: string;
  link: string;
  detail: string;
}

/** The site search, for putting a record into a page as a card or a link. */
@Component({
  selector: 'app-record-picker',
  imports: [FormsModule],
  templateUrl: './record-picker.component.html',
  styleUrl: './record-picker.component.scss'
})
export class RecordPickerComponent {
  @Output() card = new EventEmitter<RecordPick & { year: string }>();
  @Output() link = new EventEmitter<RecordPick>();
  @Output() closed = new EventEmitter<void>();

  query = '';
  year = '';
  results: RecordPick[] = [];
  searching = false;
  private readonly queries = new Subject<string>();

  constructor(private api: ApiService) {
    this.queries.pipe(debounceTime(250), distinctUntilChanged(), switchMap(q => {
      this.searching = true;
      return this.api.getTypeRequest(`all?name=${encodeURIComponent(q)}`);
    })).subscribe((rows: any) => {
      this.searching = false;
      this.results = (Array.isArray(rows) ? rows : []).map((r: any) => this.pick(r)).filter((r: RecordPick | null): r is RecordPick => !!r);
    });
  }

  pickCard(r: RecordPick): void {
    this.card.emit({ ...r, year: this.year });
  }

  search(): void {
    const q = this.query.trim();
    if (q.length < 2) { this.results = []; return; }
    this.queries.next(q);
  }

  private pick(r: any): RecordPick | null {
    if (r.type === 'institution') {
      return { kind: 'institution', id: r.instID, name: r.instName || 'Unnamed institution', link: `/institutions/${r.instID}`,
        detail: [r.instType, r.diocese && `Diocese of ${r.diocese}`].filter(Boolean).join(' · ') };
    }
    if (r.type === 'person') {
      return { kind: 'person', id: r.persID, name: [r.title, r.name, r.suffix].filter(Boolean).join(' '), link: `/people/${r.persID}`,
        detail: [r.diocese && `Diocese of ${r.diocese}`, r.yearStart && (r.yearStart === r.yearEnd ? r.yearStart : `${r.yearStart}–${r.yearEnd}`)].filter(Boolean).join(' · ') };
    }
    if (r.type === 'county') {
      return { kind: 'county', id: r.countyID, name: `${r.name} County, ${r.state}`, link: `/places/county/${r.countyID}`,
        detail: `${r.institutions} institutions` };
    }
    return null;
  }
}
