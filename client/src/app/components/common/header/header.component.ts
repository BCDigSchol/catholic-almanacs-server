import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common'; 

import {MatToolbarModule} from '@angular/material/toolbar'; 
import {MatIconModule} from '@angular/material/icon'; 
import {MatButtonModule} from '@angular/material/button'; 
import { ActivatedRoute } from '@angular/router';

import { Settings } from '../../../app.settings';

@Component({
  selector: 'app-header',
  imports: [
    MatToolbarModule, MatIconModule, MatButtonModule,
    RouterLink, CommonModule
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})

export class HeaderComponent implements OnInit {
  @Output() navMenuToggle = new EventEmitter<boolean>();
  title = "Catholic Almanacs Database";
  isEmbedded = false;

  constructor(private _route: ActivatedRoute){

  }

  ngOnInit(): void {
    this._route.queryParamMap.subscribe(params => {
      if (params.get('embed') && params.get('embed') === 'true') {
        this.isEmbedded = true;
      }
    })
};

  toggleNav() {
    this.navMenuToggle.emit(true);
  }
}
