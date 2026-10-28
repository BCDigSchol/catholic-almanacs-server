import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Crumb {
  label: string;
  link?: string;
}

/**
 * Standard page header: breadcrumbs, optional eyebrow, title, subtitle and an
 * actions slot (`<div actions>…</div>`). The current page is the title, so
 * crumbs list only its ancestors. On narrow screens the trail collapses to a
 * single "‹ parent" link.
 */
@Component({
  selector: 'app-page-header',
  imports: [RouterLink],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss'
})
export class PageHeaderComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() eyebrow = '';
  /** Eyebrow colour, e.g. an entity token such as var(--c-inst). */
  @Input() eyebrowColor = '';
  /** Style the title as a generated label (e.g. "Unnamed church"), not a recorded name. */
  @Input() titleMuted = false;
  @Input() crumbs: Crumb[] = [];

  get parent(): Crumb | undefined {
    return [...this.crumbs].reverse().find(c => c.link);
  }
}
