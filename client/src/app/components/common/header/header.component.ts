import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common'; 

import {MatToolbarModule} from '@angular/material/toolbar'; // MatToolbarModule is a module that provides a Material Design toolbar component for Angular applications
import {MatIconModule} from '@angular/material/icon'; // MatIconModule is a module that provides Material Design icons for Angular applications 
import {MatButtonModule} from '@angular/material/button'; // MatButtonModule is a module that provides Material Design buttons for Angular applications
import {MatMenuModule} from '@angular/material/menu'; // MatMenuModule is a module that provides Material Design menus for Angular applications

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
    name: 'About',
    route: 'about'
  }];
}
