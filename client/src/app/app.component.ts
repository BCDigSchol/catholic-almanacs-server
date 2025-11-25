import { Component, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/common/header/header.component';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { Router, NavigationStart } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NavigationService } from './services/navigation.service';
import { SidenavComponent } from './components/common/sidenav/sidenav.component';
import { ThemeService } from './services/theme.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, MatSidenavModule, SidenavComponent, CommonModule],
  providers: [ThemeService], // similar to import, provide the ThemeService to the component
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
}) // @Component -- decorator, used (in Angular) to mark a class as a component and provide metadata about it;
   // put right before the class AppComponent to decorate it
export class AppComponent implements OnInit {
  @ViewChild('sidenav') sidenav!: MatSidenav;
  title = 'catholic-almanacs';
  navMenuToggled: boolean = false;
  isDarkTheme$: Observable<boolean> = new Observable<boolean>();
  isDarkTheme: boolean = false;
  isMobile: boolean = false;
  constructor (
    private router: Router,
    private navigationService: NavigationService,
    private themeService: ThemeService
  ) {
    this.router.events
    .pipe(filter(event => event instanceof NavigationStart))
    .subscribe((event: any) => {
      this.navigationService.lastNavigationTrigger = event.navigationTrigger;
    });
  }

  ngOnInit (): void {
    this.isDarkTheme$ = this.themeService.isDarkTheme$;
    this.isDarkTheme$.subscribe(values => {
      this.isDarkTheme = values;
    })
    window.addEventListener('resize', () => {
      this.isMobile = window.innerWidth <= 600;
    });
  };

  toggleNavMenu() {
    this.navMenuToggled = !this.navMenuToggled;
    if (this.navMenuToggled) {
      this.sidenav.open();
    } else {
      this.sidenav.close();
    }
  };
}
