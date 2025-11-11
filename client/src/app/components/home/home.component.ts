import { Component } from '@angular/core';
import { OnInit } from '@angular/core';

import { MatTabsModule } from '@angular/material/tabs';
import { HomePageComponent } from "./home-page/home-page.component";
import { ActivatedRoute } from '@angular/router'; 

@Component({
  selector: 'app-home',
  imports: [MatTabsModule, HomePageComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  constructor(private _route: ActivatedRoute){
  }
  isEmbedded = false;

  ngOnInit () {
    this._route.queryParamMap.subscribe(params => {
      if (params.get('embed') && params.get('embed') === 'true') {
        this.isEmbedded = true;
      }
    });
  }
}
