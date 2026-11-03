import { Component, Injector, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/common/header/header.component';
import { Router, NavigationStart, NavigationEnd } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { filter } from 'rxjs/operators';
import { NavigationService } from './services/navigation.service';
import { ThemeService } from './services/theme.service';
import { defineAlmanacElements } from './components/pages/elements/register';

const SITE_TITLE = 'Catholic Almanacs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent],
  providers: [ThemeService], // one ThemeService for the app shell and everything inside it
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'catholic-almanacs';
  isDarkTheme: boolean = false;

  constructor (
    private router: Router,
    private navigationService: NavigationService,
    private themeService: ThemeService,
    private titleService: Title,
    injector: Injector,
  ) {
    defineAlmanacElements(injector); // the <almanac-*> tags content pages use
    this.router.events
    .pipe(filter(event => event instanceof NavigationStart))
    .subscribe((event: any) => {
      this.navigationService.lastNavigationTrigger = event.navigationTrigger;
      this.titleBefore = this.titleService.getTitle();
    });
    // Most pages don't set the browser tab's title, so it kept the previous
    // page's. Once a page has drawn, if it set none, title it from its heading.
    this.router.events
    .pipe(filter(event => event instanceof NavigationEnd))
    .subscribe(() => setTimeout(() => this.titleFromHeading(), 400));
  }

  private titleBefore = '';

  private titleFromHeading(): void {
    if (this.titleService.getTitle() !== this.titleBefore) return;   // the page set its own
    const heading = document.querySelector('main h1, .page h1')?.textContent?.replace(/\s+/g, ' ').trim();
    this.titleService.setTitle(heading && heading !== SITE_TITLE ? `${heading} · ${SITE_TITLE}` : SITE_TITLE);
  }

  ngOnInit (): void {
    this.themeService.isDarkTheme$.subscribe(value => {
      this.isDarkTheme = value;
      // Overlays (menus, selects, dialogs) render outside .app, so the
      // theme class also goes on <body> for them to pick up the dark tokens.
      document.body.classList.toggle('dark-theme', value);
    });
  };
}
