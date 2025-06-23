import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { Settings } from '../../../app.settings';

@Component({
  selector: 'app-sidenav',
  imports: [MatListModule, CommonModule, MatButtonModule],
  templateUrl: './sidenav.component.html',
  styleUrl: './sidenav.component.scss'
})
export class SidenavComponent implements OnInit {
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
      name: 'Institutions Map',
      route: 'institutions/map'
    },
    {
      name: 'People Map',
      route: 'people/map'
    }
  ]

  constructor (private _router: Router) {
  }

  ngOnInit(): void {
    if (Settings.exportEnabled) {
      this.navItems.push({
        name: 'Export',
        route: 'export'
      });
    }
  }

  // routerLink is used in HTMLs to navigate to different routes; navigate() is used in TypeScript and can add other logic
  navigate(path: string) {
    this._router.navigate([path]);
    this.menuClicked.emit();
  }
}
