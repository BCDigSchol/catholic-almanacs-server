import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type VizState = 'ready' | 'loading' | 'empty' | 'error';

/**
 * Frame for one visual (chart, map, network): title and note, an actions
 * slot, a collapsible key (`<div key>…</div>`), a fullscreen button, and
 * loading / empty / error states. The visual itself (default content) stays
 * mounted while loading so d3 charts and maps aren't torn down and rebuilt;
 * an overlay covers it instead. The visual sizes itself to the panel's width.
 */
@Component({
  selector: 'app-viz-panel',
  imports: [MatIconModule],
  templateUrl: './viz-panel.component.html',
  styleUrl: './viz-panel.component.scss'
})
export class VizPanelComponent {
  @Input() heading = '';
  /** Small line beside the heading, e.g. "419 of 2,247 shown". */
  @Input() note = '';
  @Input() state: VizState = 'ready';
  @Input() emptyText = 'Nothing to show for these filters.';
  @Input() errorText = 'This view couldn’t be loaded.';
  /** Show the collapsible key toggle (when a `[key]` slot is provided). */
  @Input() hasKey = false;
  @Input() keyOpen = true;
  @Input() allowFullscreen = true;
  @Output() retry = new EventEmitter<void>();

  fullscreen = false;

  constructor(private host: ElementRef<HTMLElement>) {}

  async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await this.host.nativeElement.requestFullscreen();
      }
    } catch { /* fullscreen refused (e.g. in an iframe): ignore */ }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.fullscreen = document.fullscreenElement === this.host.nativeElement;
    // Let maps and charts that watch their size re-measure.
    window.dispatchEvent(new Event('resize'));
  }
}
