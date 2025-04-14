import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ApiService } from '../../services/api.service'; 

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  loading = true;
  data: any[] = [];

  constructor(public apiService: ApiService) {

  }
  
  ngOnInit() {
    this.apiService.getTypeRequest('church').subscribe((response: any) => {
      this.data = response.rows;
      this.loading = false;
    })
  }


}
