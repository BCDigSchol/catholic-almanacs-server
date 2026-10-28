import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';

import { Settings } from '../../../app.settings';
import { ThemeService } from '../../../services/theme.service';
import { HeaderSearchComponent } from '../header-search/header-search.component';

interface NavItem {
  name: string;
  route: string;
}

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, MatIconModule, HeaderSearchComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  title = 'Catholic Almanacs';
  isEmbedded = false;
  isDarkTheme = false;
  menuOpen = false;
  searchOpen = false;

  navItems: NavItem[] = [
    { name: 'Institutions', route: '/institutions' },
    { name: 'People', route: '/people' },
    { name: 'Dashboards', route: '/dashboards' },
    { name: 'About', route: '/pages/about' },
  ];

  constructor(private _route: ActivatedRoute, private router: Router, private themeService: ThemeService) {}

  ngOnInit(): void {
    if (Settings.exportEnabled) {
      this.navItems.push({ name: 'Export', route: '/export' });
    }
    this._route.queryParamMap.subscribe(params => {
      if (params.get('embed') === 'true') {
        this.isEmbedded = true;
      }
    });
    this.themeService.isDarkTheme$.subscribe(value => this.isDarkTheme = value);
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

  closePanels(): void {
    this.menuOpen = false;
    this.searchOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closePanels();
  }
}
