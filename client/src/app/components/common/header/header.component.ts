import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';

import { ThemeService } from '../../../services/theme.service';
import { ReviewAuthService } from '../../../services/review-auth.service';
import { NavItem, NavService } from '../../../services/nav.service';
import { HeaderSearchComponent } from '../header-search/header-search.component';
import { NavListComponent } from '../nav-list/nav-list.component';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, MatIconModule, HeaderSearchComponent, NavListComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  title = 'Catholic Almanacs';
  isEmbedded = false;
  isDarkTheme = false;
  menuOpen = false;
  searchOpen = false;

  /** The built-in items, then what page-content/site-nav.json adds. */
  navItems: NavItem[] = [];
  /** The wide-screen dropdown open now, if any. */
  openDrop: NavItem | null = null;

  /** The editors' sign-in (for the Data Issues page). */
  signedIn = false;

  constructor(private _route: ActivatedRoute, private router: Router, private themeService: ThemeService,
              private reviewAuth: ReviewAuthService, private nav: NavService, private host: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    this.nav.items$.subscribe(items => this.navItems = items);
    this._route.queryParamMap.subscribe(params => {
      if (params.get('embed') === 'true') {
        this.isEmbedded = true;
      }
    });
    this.themeService.isDarkTheme$.subscribe(value => this.isDarkTheme = value);
    this.reviewAuth.signedIn$.subscribe(value => this.signedIn = value);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.closePanels());
  }

  toggleTheme(): void {
    this.themeService.setTheme(!this.isDarkTheme);
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    this.searchOpen = false;
  }

  toggleSearch(): void {
    this.searchOpen = !this.searchOpen;
    this.menuOpen = false;
  }

  /** Whether the open dropdown was opened by the pointer resting on it. */
  private hovered = false;

  /** A click (or Enter) opens a dropdown, and closes one it opened itself. */
  toggleDrop(item: NavItem): void {
    this.openDrop = this.openDrop === item && !this.hovered ? null : item;
    this.hovered = false;
  }

  /** Hovering opens a dropdown; leaving it closes it. */
  hoverDrop(item: NavItem | null): void {
    this.openDrop = item;
    this.hovered = !!item;
  }

  closePanels(): void {
    this.menuOpen = false;
    this.searchOpen = false;
    this.openDrop = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closePanels();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.openDrop && !this.host.nativeElement.contains(event.target as Node)) this.openDrop = null;
  }

  @HostListener('focusout', ['$event'])
  onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (this.openDrop && next && !this.host.nativeElement.contains(next)) this.openDrop = null;
  }
}
