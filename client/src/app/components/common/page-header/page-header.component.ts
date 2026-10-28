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
  @Input() crumbs: Crumb[] = [];

  get parent(): Crumb | undefined {
    return [...this.crumbs].reverse().find(c => c.link);
  }
}
