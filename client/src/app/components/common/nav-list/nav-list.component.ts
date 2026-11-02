import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { NavItem } from '../../../services/nav.service';

/**
 * A list of navigation entries, nested to any depth: links, and groups whose
 * children are listed beneath them. In a header dropdown (`collapsible`
 * false) groups are sections with an italic label; in the phone menu
 * (`collapsible` true) each group is an accordion row.
 */
@Component({
  selector: 'app-nav-list',
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './nav-list.component.html',
  styleUrl: './nav-list.component.scss'
})
export class NavListComponent {
  @Input() items: NavItem[] = [];
  @Input() depth = 0;
  @Input() collapsible = false;

  private readonly open = new Set<NavItem>();

  isOpen(item: NavItem): boolean {
    return !this.collapsible || this.open.has(item);
  }

  toggle(item: NavItem): void {
    if (this.open.has(item)) this.open.delete(item); else this.open.add(item);
  }
}
