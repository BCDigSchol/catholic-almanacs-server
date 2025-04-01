import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import {TestComponent} from '../common/test/test.component';

import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

@Component({
  selector: 'app-home',
  imports: [CommonModule, TestComponent, MatButtonModule, MatIconModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  message = 'Hello from HomeComponent!';
  data = null;
  isLoaded = false;

  ngOnInit(): void {
    //this.message = 'Message is initialized!';
    this.isLoaded = true;
  };

  changeMessage() {
    this.message = 'Hello from changed message!';
  };

  handleEmittedData(data: any) {
    this.message = data.testMessage;
  };
}
