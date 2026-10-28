import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';

export interface YearRange {
  from: number;
  to: number;
}

/**
 * A year range as a two-thumb slider paired with typed From / To fields that
 * stay in sync. Emits on slider release, Enter or leaving a field, with values
 * clamped to [min, max] and put in order.
 */
@Component({
  selector: 'app-year-range',
  imports: [FormsModule, MatSliderModule],
  templateUrl: './year-range.component.html',
  styleUrl: './year-range.component.scss'
})
export class YearRangeComponent implements OnChanges {
  @Input() min = 1833;
  @Input() max = 1870;
  @Input() from?: number;
  @Input() to?: number;
  /** Prefix for the field ids, so two ranges on one page stay distinct. */
  @Input() idPrefix = 'years';
  @Output() rangeChange = new EventEmitter<YearRange>();

  start = this.min;
  end = this.max;

  ngOnChanges(): void {
    this.start = this.from ?? this.min;
    this.end = this.to ?? this.max;
  }

  commit(): void {
    let start = this.clamp(this.start, this.min);
    let end = this.clamp(this.end, this.max);
    if (start > end) [start, end] = [end, start];
    this.start = start;
    this.end = end;
    if (start !== (this.from ?? this.min) || end !== (this.to ?? this.max)) {
      this.rangeChange.emit({ from: start, to: end });
    }
  }

  private clamp(value: number, fallback: number): number {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(this.max, Math.max(this.min, n));
  }
}
