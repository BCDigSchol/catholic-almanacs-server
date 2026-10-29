import { Component, ElementRef, EventEmitter, Input, Output } from '@angular/core';

export interface SegmentOption<T = string> {
  value: T;
  label: string;
}

/**
 * A compact one-of-several switch (e.g. Institutions | People, Share | Count).
 * Behaves as a radio group: arrow keys move the selection.
 */
@Component({
  selector: 'app-segmented',
  imports: [],
  templateUrl: './segmented.component.html',
  styleUrl: './segmented.component.scss'
})
export class SegmentedComponent<T = string> {
  @Input({ required: true }) options: SegmentOption<T>[] = [];
  @Input() value?: T;
  /** Accessible name for the group, e.g. "Count by". */
  @Input() label = '';
  /** Show the label visibly above the switch. */
  @Input() showLabel = false;
  @Output() valueChange = new EventEmitter<T>();

  constructor(private host: ElementRef<HTMLElement>) {}

  select(value: T): void {
    if (value !== this.value) {
      this.value = value;
      this.valueChange.emit(value);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const i = this.options.findIndex(o => o.value === this.value);
    const next = this.options[(i + delta + this.options.length) % this.options.length];
    this.select(next.value);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  }
}
