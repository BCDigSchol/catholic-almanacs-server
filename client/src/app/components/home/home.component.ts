import { Component } from '@angular/core';

import { MatTabsModule } from '@angular/material/tabs';
import { HomePageComponent } from "./home-page/home-page.component";

@Component({
  selector: 'app-home',
  imports: [MatTabsModule, HomePageComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  
}
