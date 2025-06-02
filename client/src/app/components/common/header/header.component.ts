import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common'; 

import {MatToolbarModule} from '@angular/material/toolbar'; 
import {MatIconModule} from '@angular/material/icon'; 
import {MatButtonModule} from '@angular/material/button'; 
import {MatMenuModule} from '@angular/material/menu'; 

import { Settings } from '../../../app.settings';

@Component({
  selector: 'app-header',
  imports: [
    MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule,
    RouterLink, CommonModule
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})

export class HeaderComponent implements OnInit {
  title = "Catholic Almanacs Database";

  navItems = [{
    name: 'Home',
    route: 'home'
  }, {
    name: 'Institutions',
    route: 'institutions'
  },{
    name: 'People',
    route: 'people'
  },{
    name: 'About',
    route: 'about'
  }];

ngOnInit(): void {
      if (Settings.exportEnabled) {
      this.navItems.push({
        name: 'Export',
        route: 'export'
      });
    }
  }
}
