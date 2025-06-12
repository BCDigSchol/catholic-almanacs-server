import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/common/header/header.component';
import { Router, NavigationStart } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NavigationService } from './services/navigation.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
}) // @Component -- decorator, used (in Angular) to mark a class as a component and provide metadata about it;
   // put right before the class AppComponent to decorate it
export class AppComponent {
  title = 'catholic-almanacs';

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
}
