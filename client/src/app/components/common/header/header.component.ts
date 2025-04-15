import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common'; 

import {MatToolbarModule} from '@angular/material/toolbar'; 
import {MatIconModule} from '@angular/material/icon'; 
import {MatButtonModule} from '@angular/material/button'; 
import {MatMenuModule} from '@angular/material/menu'; 

@Component({
  selector: 'app-header',
  imports: [
    MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule,
    RouterLink, CommonModule
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  title = "Catholic Almanacs";

  navItems = [{
    name: 'Home',
    route: 'home'
  }, {
    name: 'Institutions',
    route: 'institutions'
  },{
    name: 'About',
    route: 'about'
  }];
}
