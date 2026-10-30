import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { ApiService } from '../../../services/api.service';
import { institutionLabel } from '../../../utils/record-labels';

export interface FocusPick {
  id: string;
  label: string;
}

/**
 * "Focus on": finds any institution or person by name (the site search,
 * GET all?name=), not only the nodes drawn, so a network page can centre on
 * them. Emits the pick; the page puts it in the URL.
 */
@Component({
  selector: 'app-network-focus',
  imports: [],
  templateUrl: './network-focus.component.html',
  styleUrl: './network-focus.component.scss'
})
export class NetworkFocusComponent implements OnInit, OnDestroy {
  /** Which kinds of record the network's nodes are. */
  @Input() kinds: ('institution' | 'person')[] = ['institution', 'person'];
  @Input() idPrefix = 'focus';
  @Output() pick = new EventEmitter<FocusPick>();

  query = '';
  open = false;
  options: (FocusPick & { detail: string })[] = [];
  private queries = new Subject<string>();
  private sub?: Subscription;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.sub = this.queries.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => q.length < 2 ? of([]) : this.api.getTypeRequest('all?name=' + encodeURIComponent(q)).pipe(catchError(() => of([])))),
    ).subscribe((rows: any) => {
      this.options = (rows as any[])
        .filter(r => this.kinds.includes(r.type))
        .slice(0, 8)
        .map(r => r.type === 'institution'
          ? { id: r.instID, label: institutionLabel(r.instName), detail: r.diocese ? `Diocese of ${r.diocese}` : '' }
          : { id: r.persID, label: [r.title, r.name, r.suffix].filter(Boolean).join(' '),
              detail: r.yearStart === r.yearEnd ? `${r.yearStart}` : `${r.yearStart}–${r.yearEnd}` });
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onInput(value: string): void {
    this.query = value;
    this.open = true;
    this.queries.next(value.trim());
  }

  choose(option: FocusPick): void {
    this.pick.emit({ id: option.id, label: option.label });
    this.query = '';
    this.options = [];
    this.open = false;
  }

  /** Enter takes the first match. */
  onEnter(): void {
    if (this.options.length) this.choose(this.options[0]);
  }

  /** Let a click on an option land before the list closes. */
  onBlur(): void {
    setTimeout(() => this.open = false, 150);
  }
}
