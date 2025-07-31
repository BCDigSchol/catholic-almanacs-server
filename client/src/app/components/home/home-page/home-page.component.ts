import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OnInit } from '@angular/core';

import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-home-page',
  imports: [CommonModule, MatInputModule, MatFormFieldModule, MatIconModule,
    FormsModule, MatCardModule, RouterLink, MatIcon
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
})
export class HomePageComponent {

  inputName: string = '';
  data: any[] = [];

  constructor(private apiService: ApiService) {
  }

  ngOnInit() {
    this.getData();
  }

  getData() {
    let queryString = `?name=${this.inputName}`;
    this.apiService.getTypeRequest('all' + queryString).subscribe((res:any) => {
      this.data = res;
    })
  }
}
