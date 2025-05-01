import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { SelectYearComponent } from '../../common/select-year/select-year.component';

import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-person-details',
  imports: [CommonModule, MatCardModule, MatListModule, MatTableModule, MatButtonModule,
    RouterLink, SelectYearComponent
],
  templateUrl: './person-details.component.html',
  styleUrl: './person-details.component.scss'
})
export class PersonDetailsComponent implements OnInit{
  loading = true;
  itemId: any;
  data: any = [];
  processedData: any = {};

  constructor(
    private _route: ActivatedRoute,
    private _api: ApiService,
  ) {}

  ngOnInit () {
    this.itemId = this._route.snapshot.paramMap.get('id');
    this.getData();
  }

  getData () {
    this._api.getTypeRequest('person/' + this.itemId).subscribe((res: any) => {
      this.data = res[0];
      this.loading = false;
      this.processData();
    }
    );}

  onYearSelected (year: number | string) {
    //this.loading = true;
    if (year === 'All') {
      this.getData();
    } else {
      this._api.getTypeRequest('person/' + this.processedData.persID + '/' + year).subscribe((res: any) => {
      this.loading = false;
      this.processedData.name = res.almanacRecords[0].personInAlmanacRecord.name || '(Not Recorded)';
      this.processedData.title = res.almanacRecords[0].personInAlmanacRecord.title || '(Not Recorded)';
      this.processedData.suffix = res.almanacRecords[0].personInAlmanacRecord.suffix || '(Not Recorded)';
      this.processedData.note = res.almanacRecords[0].personInAlmanacRecord.note || '(Not Recorded)';
      let uniqueAlmanacRecords = new Set();
      this.processedData.almanacRecords = [];
      console.log(res.almanacRecords);
      for (let i = res.almanacRecords.length - 1; i >= 0; i--) {
        const record = res.almanacRecords[i];
        console.log(record);
        if (record.instID && !uniqueAlmanacRecords.has(record.instID)) {
          uniqueAlmanacRecords.add(record.instID);
          this.processedData.almanacRecords.push(record);
        }
      }
      })};
  }

  processData () {
    //console.log(this.data);
    //console.log(this.data.almanacRecords.length);
    this.processedData.persID = this.data.ID;
    this.processedData.name = this.data.almanacRecords[this.data.almanacRecords.length - 1].personInAlmanacRecord.name || '(Not Recorded)';
    this.processedData.title = this.data.almanacRecords[this.data.almanacRecords.length - 1].personInAlmanacRecord.title || '(Not Recorded)';
    this.processedData.suffix = this.data.almanacRecords[this.data.almanacRecords.length - 1].personInAlmanacRecord.suffix || '(Not Recorded)';
    this.processedData.note = this.data.almanacRecords[this.data.almanacRecords.length - 1].personInAlmanacRecord.note || '(Not Recorded)';
    this.processedData.year = [];
    for (let i of this.data.almanacRecords) {
      if (i.year && !this.processedData.year.includes(i.year)) {
        this.processedData.year.push(i.year);
      }
    };
    let uniqueAlmanacRecords = new Set();
    this.processedData.almanacRecords = [];
    for (let i = this.data.almanacRecords.length - 1; i >= 0; i--) {
      const record = this.data.almanacRecords[i];
      if (record.instID && !uniqueAlmanacRecords.has(record.instID)) {
        uniqueAlmanacRecords.add(record.instID);
        this.processedData.almanacRecords.push(record);
      }
    }
  };
}
