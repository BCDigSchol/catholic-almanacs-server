import { Component, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/common/header/header.component';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { Router, NavigationStart } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NavigationService } from './services/navigation.service';
import { SidenavComponent } from './components/common/sidenav/sidenav.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, MatSidenavModule, SidenavComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
}) // @Component -- decorator, used (in Angular) to mark a class as a component and provide metadata about it;
   // put right before the class AppComponent to decorate it
export class AppComponent {
  @ViewChild('sidenav') sidenav!: MatSidenav;
  title = 'catholic-almanacs';
  navMenuToggled: boolean = false;

  constructor (
    private router: Router,
    private navigationService: NavigationService
  ) {
    this.router.events
    .pipe(filter(event => event instanceof NavigationStart))
    .subscribe((event: any) => {
      this.navigationService.lastNavigationTrigger = event.navigationTrigger;
    });
  }

  toggleNavMenu() {
    this.navMenuToggled = !this.navMenuToggled;
    if (this.navMenuToggled) {
      this.sidenav.open();
    } else {
      this.sidenav.close();
    }
  }
}
