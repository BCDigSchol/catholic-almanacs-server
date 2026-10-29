import { Component, ContentChild, Input, NgZone, OnDestroy, OnInit, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { SheetComponent } from '../sheet/sheet.component';

export interface ControlChip {
  label: string;
  clear: () => void;
}

/** Below this width the filters move into a full-screen sheet. */
const COMPACT_QUERY = '(max-width: 760px)';

/**
 * A dashboard's controls in one wrapping row. Always-visible controls (e.g.
 * an entity switch) go in `[primary]`; the rest go in `<ng-template #filters>`,
 * shown inline on wide screens and in a "Filters" sheet on phones. Active
 * filters show as removable chips.
 */
@Component({
  selector: 'app-control-bar',
  imports: [NgTemplateOutlet, MatIconModule, SheetComponent],
  templateUrl: './control-bar.component.html',
  styleUrl: './control-bar.component.scss'
})
export class ControlBarComponent implements OnInit, OnDestroy {
  @ContentChild('filters') filters?: TemplateRef<unknown>;
  @Input() chips: ControlChip[] = [];
  /** Clears every filter; shows "Clear all" when set and there are chips. */
  @Input() clearAll?: () => void;

  compact = false;
  sheetOpen = false;
  private media?: MediaQueryList;
  private onMedia = (e: MediaQueryListEvent) => this.zone.run(() => {
    this.compact = e.matches;
    if (!e.matches) this.sheetOpen = false;
  });

  constructor(private zone: NgZone) {}

  ngOnInit(): void {
    this.media = window.matchMedia(COMPACT_QUERY);
    this.compact = this.media.matches;
    this.media.addEventListener('change', this.onMedia);
  }

  ngOnDestroy(): void {
    this.media?.removeEventListener('change', this.onMedia);
  }
}
