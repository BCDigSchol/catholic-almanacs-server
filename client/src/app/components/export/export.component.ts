import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeUrl, Title } from '@angular/platform-browser';

import { ApiService } from '../../services/api.service';
import { PageHeaderComponent } from '../common/page-header/page-header.component';

type Format = 'json' | 'csv';

@Component({
  selector: 'app-export',
  imports: [CommonModule, PageHeaderComponent],
  templateUrl: './export.component.html',
  styleUrl: './export.component.scss'
})
export class ExportComponent implements OnInit {
  readonly formats: Format[] = ['json', 'csv'];
  format: Format = 'json';
  downloadURI: SafeUrl | null = null;
  fileDates: { fileName: string; date: string }[] = [];
  loading = true;

  constructor(private _apiService: ApiService, private sanitizer: DomSanitizer, private title: Title) {}

  ngOnInit(): void {
    this.title.setTitle('Export · Catholic Almanacs');
    this._apiService.getTypeRequest('getFileDate').subscribe({
      next: (res: any) => { this.fileDates = Array.isArray(res) ? res : []; this.loading = false; },
      error: () => this.loading = false,
    });
    this.downloadData();
  }

  setFormat(format: Format): void {
    if (format === this.format) return;
    this.format = format;
    this.downloadData();
  }

  downloadData(): void {
    this.downloadURI = null;
    const format = this.format;
    this._apiService.getBlobRequest('export?format=' + format).subscribe((res: any) => {
      const reader = new FileReader();
      reader.onload = () => {
        // a slower earlier request must not overwrite the current format's file
        if (format === this.format) this.downloadURI = this.sanitizer.bypassSecurityTrustUrl(reader.result as string);
      };
      reader.readAsDataURL(res as Blob);
    });
  }
}
