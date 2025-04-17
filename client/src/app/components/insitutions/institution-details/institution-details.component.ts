import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';

import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-institution-details',
  imports: [CommonModule, MatCardModule, MatListModule, MatTableModule, MatButtonModule,
            RouterLink
  ],
  templateUrl: './institution-details.component.html',
  styleUrl: './institution-details.component.scss'
})
export class InstitutionDetailsComponent implements OnInit {
  loading = true;
  itemId: any;
  data: any = [];
  processedData: any = {};

  displayedColumns: string[] = ['instName', 'instYear', 'diocese', 'language', 'church_type', 'city_reg', 'state_orig'];

  constructor(
    private _route: ActivatedRoute,
    private _api: ApiService
  ) { }

  ngOnInit () {
    this.itemId = this._route.snapshot.paramMap.get('id');
    this.getData();
  }

  getData () {
    this._api.getTypeRequest('church/' + this.itemId).subscribe((res: any) => {
      this.data = res;
      this.loading = false;
      this.processData();
    }
    );
  }

  /**
   * processes the data received from the API: for certain fields, only keeps the metadata of the year 1870,
   * for attending institutions and people, display all the relevant institutions/people and their years
   */
  processData () {
      this.processedData.instYear = []
      for (let i of this.data.churchInYear) {
        this.processedData.instYear.push(i.instYear);
      }
      this.processedData.church_type = this.data.churchInYear[this.data.churchInYear.length - 1].church_type || '(Not Recorded)';
      this.processedData.language = this.data.churchInYear[this.data.churchInYear.length - 1].language || '(Not Recorded)';
      this.processedData.diocese = this.data.churchInYear[this.data.churchInYear.length - 1].diocese || '(Not Recorded)';
      this.processedData.city_reg = this.data.churchInYear[this.data.churchInYear.length - 1].city_reg || '(Not Recorded)';
      this.processedData.state_orig = this.data.churchInYear[this.data.churchInYear.length - 1].state_orig || '(Not Recorded)';
      this.processedData.instNote = this.data.churchInYear[this.data.churchInYear.length - 1].instNote || '(Not Recorded)';
      this.processedData.attendingChurches = this.data.churchInYear[this.data.churchInYear.length - 1].attendingChurches || '(Not Recorded)';
      this.processedData.attendedBy = this.data.churchInYear[this.data.churchInYear.length - 1].attendedBy || '(Not Recorded)';
      this.processedData.personInfo = this.data.churchInYear[this.data.churchInYear.length - 1].personInfo || '(Not Recorded)';
  

      for (let i of this.data.churchInYear) {
        for (let pers of i.personInfo) {
          if (!this.processedData.personInfo.some((exisitingPers: any) => exisitingPers.persID === pers.persID)) {
            this.processedData.personInfo.push(pers);
          }
        }
      }

      for (let i of this.data.churchInYear) {
        for (let inst of i.attendingChurches) {
          if (!this.processedData.attendingChurches.some((exisitingInst: any) => exisitingInst.instID === inst.instID)) {
            this.processedData.attendingChurches.push(inst);
          }
        }
      }
  }
}
