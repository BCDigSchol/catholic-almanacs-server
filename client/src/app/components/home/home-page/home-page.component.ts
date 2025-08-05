import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OnInit } from '@angular/core';

import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-home-page',
  imports: [CommonModule, MatInputModule, MatFormFieldModule, MatIconModule,
    FormsModule, MatCardModule, RouterLink, MatIcon, MatProgressSpinnerModule
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
})
export class HomePageComponent {

  inputName: string = '';
  institutions: any[] = [];
  people: any[] = [];
  data: any[] = [];
  loading: boolean = true;

  constructor(private apiService: ApiService, private router: Router) { 
    this.getData();
  };

  ngOnInit() {
    this.getData();
  };

  getData() {
    this.loading = true;
    let queryString = `?name=${this.inputName}`;
    this.apiService.getTypeRequest('all' + queryString).subscribe((res:any) => {
      this.data = res;
      this.institutions = this.data.filter(item => item.type === 'institution');
      this.people = this.data.filter(item => item.type === 'person');
      this.loading = false;
    })
  };

  navigateToInstitutions() {
    this.router.navigate(['/institutions'], { queryParams: { name: this.inputName } });
  };

  navigateToPeople() {
    this.router.navigate(['/people'], { queryParams: { name: this.inputName } });
  }
}
