import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Full-screen panel for phones (e.g. filters). Project the body as content
 * and the footer actions into `<div sheet-footer>…</div>`. Escape closes it.
 */
@Component({
  selector: 'app-sheet',
  imports: [MatIconModule],
  templateUrl: './sheet.component.html',
  styleUrl: './sheet.component.scss'
})
export class SheetComponent {
  @Input({ required: true }) heading = '';
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  close(): void {
    this.closed.emit();
  }
}
