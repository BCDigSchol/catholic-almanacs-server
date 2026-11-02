import { Component, Injector, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/common/header/header.component';
import { Router, NavigationStart } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NavigationService } from './services/navigation.service';
import { ThemeService } from './services/theme.service';
import { defineAlmanacElements } from './components/pages/elements/register';

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
    injector: Injector,
  ) {
    defineAlmanacElements(injector); // the <almanac-*> tags content pages use
    this.router.events
    .pipe(filter(event => event instanceof NavigationStart))
    .subscribe((event: any) => {
      this.navigationService.lastNavigationTrigger = event.navigationTrigger;
    });
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
