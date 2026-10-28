import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core';

interface Tab {
  year: number | null;   // null = all years
  label: string;
  gapBefore?: string;    // years missing just before this tab, e.g. "1839–1863"
}

/**
 * The year switcher on record pages: "All years" (everything recorded,
 * merged) first, then one tab per almanac year the record appears in, with a
 * break where years are missing. Scrolls sideways on narrow screens; arrow
 * keys move between tabs.
 */
@Component({
  selector: 'app-year-tabs',
  imports: [],
  templateUrl: './year-tabs.component.html',
  styleUrl: './year-tabs.component.scss'
})
export class YearTabsComponent implements OnChanges {
  @Input() years: number[] = [];
  /** The selected year, or null for all years. */
  @Input() selected: number | null = null;
  @Output() selectedChange = new EventEmitter<number | null>();
  @ViewChild('list', { static: true }) list!: ElementRef<HTMLElement>;

  tabs: Tab[] = [];

  ngOnChanges(): void {
    const years = [...new Set(this.years)].sort((a, b) => a - b);
    this.tabs = [{ year: null, label: 'All years' }];
    years.forEach((year, i) => {
      const prev = years[i - 1];
      const gap = prev !== undefined && year - prev > 1
        ? (year - prev === 2 ? `${prev + 1}` : `${prev + 1}–${year - 1}`)
        : undefined;
      this.tabs.push({ year, label: String(year), gapBefore: gap });
    });
    // Keep the selected tab in view (e.g. when arriving at ?year=1869 on a phone).
    setTimeout(() => this.list.nativeElement.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' }));
  }

  select(year: number | null): void {
    if (year !== this.selected) {
      this.selectedChange.emit(year);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const i = this.tabs.findIndex(t => t.year === this.selected);
    const next = this.tabs[(i + (event.key === 'ArrowRight' ? 1 : -1) + this.tabs.length) % this.tabs.length];
    this.select(next.year);
    setTimeout(() => this.list.nativeElement.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  }
}
