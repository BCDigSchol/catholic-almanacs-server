import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';

/** Previous / numbered pages / Next. Pages are 1-based. */
@Component({
  selector: 'app-pager',
  imports: [],
  templateUrl: './pager.component.html',
  styleUrl: './pager.component.scss'
})
export class PagerComponent implements OnChanges {
  @Input() page = 1;
  @Input() size = 25;
  @Input() total = 0;
  @Output() pageChange = new EventEmitter<number>();

  pages = 1;
  /** Page numbers to show; null marks an ellipsis. */
  window: (number | null)[] = [];

  ngOnChanges(): void {
    this.pages = Math.max(1, Math.ceil(this.total / this.size));
    const keep = new Set([1, this.pages, this.page - 1, this.page, this.page + 1]);
    this.window = [];
    for (let p = 1; p <= this.pages; p++) {
      if (keep.has(p)) {
        this.window.push(p);
      } else if (this.window[this.window.length - 1] !== null) {
        this.window.push(null);
      }
    }
  }

  go(p: number): void {
    if (p >= 1 && p <= this.pages && p !== this.page) {
      this.pageChange.emit(p);
    }
  }
}
