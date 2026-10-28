import { Component, ElementRef, HostListener, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * "Cite" button for record pages: shows a ready-to-copy citation with the
 * record's permanent link and today's date.
 */
@Component({
  selector: 'app-cite',
  imports: [MatIconModule],
  templateUrl: './cite.component.html',
  styleUrl: './cite.component.scss'
})
export class CiteComponent {
  /** Record title as shown on the page. */
  @Input({ required: true }) title = '';
  /** e.g. "Institution" or "Person". */
  @Input() kind = '';
  @Input() recordId = '';
  /** e.g. "1833–1838, 1864–1870". */
  @Input() years = '';

  open = false;
  copied = false;

  constructor(private host: ElementRef<HTMLElement>) {}

  get permalink(): string {
    // The record's own URL, without the year/query state.
    return window.location.origin + window.location.pathname;
  }

  get citation(): string {
    const accessed = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    const what = [this.kind && `${this.kind} record`, this.recordId].filter(Boolean).join(' ');
    const years = this.years ? `, ${this.years}` : '';
    return `“${this.title}.” ${what}${years}. Catholic Almanacs Database. ${this.permalink} (accessed ${accessed}).`;
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.citation);
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
    } catch {
      // Clipboard refused: select the text so it can be copied by hand.
      const text = this.host.nativeElement.querySelector('.citation');
      if (text) window.getSelection()?.selectAllChildren(text);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open = false;
  }
}
