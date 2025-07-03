import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';

import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-home-page',
  imports: [CommonModule, MatInputModule, MatFormFieldModule, MatIconModule,
    FormsModule, MatCardModule
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
})
export class HomePageComponent {

  inputName: string = '';

  constructor(private apiService: ApiService) {
  }

  getData() {
    console.log('Searching for:', this.inputName);
  }

}
