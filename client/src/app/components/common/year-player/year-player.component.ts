import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Steps through a list of almanac years: play / pause, previous / next and a
 * slider that moves only between years that exist (so it never shows
 * "1845.333"). Emits the chosen year.
 */
@Component({
  selector: 'app-year-player',
  imports: [MatIconModule],
  templateUrl: './year-player.component.html',
  styleUrl: './year-player.component.scss'
})
export class YearPlayerComponent implements OnChanges, OnDestroy {
  /** Years to step through, ascending. */
  @Input() years: number[] = [];
  @Input() year: number | null = null;
  /** Milliseconds per year while playing. */
  @Input() interval = 900;
  @Input() idPrefix = 'year-player';
  @Output() yearChange = new EventEmitter<number>();

  index = 0;
  playing = false;
  /** Labels under the slider: the ends and the first year after each gap. */
  marks: { year: number; left: number }[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnChanges(): void {
    const i = this.year === null ? -1 : this.years.indexOf(this.year);
    this.index = i >= 0 ? i : 0;
    const last = Math.max(1, this.years.length - 1);
    this.marks = this.years
      .map((year, i) => ({ year, i }))
      .filter(({ year, i }) => i === 0 || i === this.years.length - 1 || year - this.years[i - 1] > 1)
      .map(({ year, i }) => ({ year, left: (i / last) * 100 }));
  }

  ngOnDestroy(): void {
    this.stop();
  }

  get current(): number | undefined {
    return this.years[this.index];
  }

  onSlide(value: string): void {
    this.stop();
    this.go(Number(value));
  }

  step(delta: number): void {
    this.stop();
    this.go(Math.min(this.years.length - 1, Math.max(0, this.index + delta)));
  }

  toggle(): void {
    this.playing ? this.stop() : this.play();
  }

  private play(): void {
    if (this.years.length < 2) return;
    if (this.index >= this.years.length - 1) this.go(0);
    this.playing = true;
    this.timer = setInterval(() => {
      if (this.index >= this.years.length - 1) {
        this.stop();
        return;
      }
      this.go(this.index + 1);
    }, this.interval);
  }

  private stop(): void {
    this.playing = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private go(index: number): void {
    this.index = index;
    const year = this.years[index];
    if (year !== undefined) this.yearChange.emit(year);
  }
}
