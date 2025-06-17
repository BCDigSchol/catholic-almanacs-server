import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sidenav',
  imports: [MatListModule, CommonModule, MatButtonModule],
  templateUrl: './sidenav.component.html',
  styleUrl: './sidenav.component.scss'
})
export class SidenavComponent {
  @Output() menuClicked = new EventEmitter<void>();

  navItems = [
    {
      name: 'Home',
      route: 'home'
    },
    {
      name: 'Institutions',
      route: 'institutions'
    },
    {
      name: 'People',
      route: 'people'
    },
    {
      name: 'About',
      route: 'about'
    },
    {
      name: 'Export',
      route: 'export'
    }
  ]

  constructor (private _router: Router) {
  }

  navigate(path: string) {
    this._router.navigate([path]);
    this.menuClicked.emit();
  }
}
