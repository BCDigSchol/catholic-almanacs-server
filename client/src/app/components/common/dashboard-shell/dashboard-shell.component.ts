import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Crumb, PageHeaderComponent } from '../page-header/page-header.component';

export interface RelatedDashboard {
  label: string;
  link: string;
}

/**
 * The frame every dashboard shares: breadcrumb, title, one-line purpose, an
 * optional takeaway sentence computed from the current view, then the page's
 * own content (usually an app-control-bar and app-viz-panels), method notes
 * in a collapsible "How this is built" (`<div notes>`), and related dashboards.
 */
@Component({
  selector: 'app-dashboard-shell',
  imports: [RouterLink, PageHeaderComponent],
  templateUrl: './dashboard-shell.component.html',
  styleUrl: './dashboard-shell.component.scss'
})
export class DashboardShellComponent {
  @Input({ required: true }) title = '';
  /** One line: what the dashboard shows. */
  @Input() purpose = '';
  /** The current view's headline finding, as a plain sentence. */
  @Input() takeaway = '';
  @Input() related: RelatedDashboard[] = [];
  /** Shown when the notes slot has content. */
  @Input() hasNotes = true;
  @Input() crumbs: Crumb[] = [{ label: 'Dashboards', link: '/dashboards' }];
}
