import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DomSanitizer } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-export',
  imports: [MatSlideToggleModule, MatButtonModule, CommonModule, MatCardModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './export.component.html',
  styleUrl: './export.component.scss'
})
export class ExportComponent implements OnInit{
  format: string = 'json';
  downloadURI: any;
  fileDates: any = {};
  loading: boolean = true;

  constructor (private _apiService: ApiService, private sanitizer: DomSanitizer) {
    this.downloadData();
  };

  ngOnInit(): void {
    this._apiService.getTypeRequest('getFileDate').subscribe((res: any) => {
      this.fileDates = res;
    });
    this.downloadData();
    this.loading = false;
  }

  toggleFormat() {
    if (this.format === 'json') {
      this.format = 'csv';
    } else {
      this.format = 'json';
    };
    this.downloadData();
  };

  downloadData() {
    this._apiService.getBlobRequest('export?format=' + this.format).subscribe((res: any) => {
      const blob = res as Blob;
      const reader = new FileReader();
      reader.onload = () => {
        const base64data = reader.result as string;
        this.downloadURI = this.sanitizer.bypassSecurityTrustUrl(base64data);
      };
      reader.readAsDataURL(blob);
    })
  }
}
