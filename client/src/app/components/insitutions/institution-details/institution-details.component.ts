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
  selector: 'app-institution-details',
  imports: [CommonModule, MatCardModule, MatListModule, MatTableModule, MatButtonModule,
            RouterLink, SelectYearComponent
  ],
  templateUrl: './institution-details.component.html',
  styleUrl: './institution-details.component.scss'
})
export class InstitutionDetailsComponent implements OnInit {
  loading = true;
  itemId: any;
  data: any = [];
  processedData: any = {};

  constructor(
    private _route: ActivatedRoute,
    private _api: ApiService,
  ) { }

  ngOnInit () {
    this.itemId = this._route.snapshot.paramMap.get('id');
    this.getData();
  }

  getData () {
    this._api.getTypeRequest('institution/' + this.itemId).subscribe((res: any) => {
      this.data = res;
      this.loading = false;
      this.processData();
    }
    );
  }

  /**
   * when a user clicks the year button, the child component emits the variable year and the yearSelected event
   * @param year 
   */
  onYearSelected (year: number | string) {
    //this.loading = true;
    if (year === 'All') {
      this.getData();
    } else {
      this._api.getTypeRequest('institution/' + this.processedData.instID + '/' + year).subscribe((res: any) => {
      this.loading = false;
      const yearTemp = this.processedData.year;
      this.processedData = res.almanacRecord[0];
      this.processedData.instID = res.ID;
      this.processedData.year = yearTemp;
    })};
  }

  /**
   * processes the data received from the API: for certain fields, only keeps the metadata of the year 1870,
   * for attending institutions and people, display all the relevant institutions/people and their years
   */
  processData () {
    this.processedData.instID = this.data.ID;
    this.processedData.instName = this.data.almanacRecord[this.data.almanacRecord.length - 1].instName || '(Not Recorded)';
    this.processedData.year = [];
    for (let i of this.data.almanacRecord) {
      this.processedData.year.push(i.year);
    };
    this.processedData.instType = this.data.almanacRecord[this.data.almanacRecord.length - 1].instType || '(Not Recorded)';
    this.processedData.language = this.data.almanacRecord[this.data.almanacRecord.length - 1].language || '(Not Recorded)';
    this.processedData.diocese = this.data.almanacRecord[this.data.almanacRecord.length - 1].diocese || '(Not Recorded)';
    this.processedData.cityReg = this.data.almanacRecord[this.data.almanacRecord.length - 1].cityReg || '(Not Recorded)';
    this.processedData.stateOrig = this.data.almanacRecord[this.data.almanacRecord.length - 1].stateOrig || '(Not Recorded)';
    this.processedData.instNote = this.data.almanacRecord[this.data.almanacRecord.length - 1].instNote || '(Not Recorded)';
    this.processedData.attendingInstitutions = this.data.almanacRecord[this.data.almanacRecord.length - 1].attendingInstitutions || '(Not Recorded)';
    this.processedData.attendedBy = this.data.almanacRecord[this.data.almanacRecord.length - 1].attendedBy || '(Not Recorded)';
    this.processedData.personInfo = this.data.almanacRecord[this.data.almanacRecord.length - 1].personInfo || '(Not Recorded)';
  

    for (let i of this.data.almanacRecord) {
      for (let pers of i.personInfo) {
        if (!this.processedData.personInfo.some((exisitingPers: any) => exisitingPers.ID === pers.ID)) {
          this.processedData.personInfo.push(pers);
        }
      }
    }
  
    //console.log(this.processedData.personInfo);

    for (let i of this.data.almanacRecord) {
      for (let inst of i.attendingInstitutions) {
        if (!this.processedData.attendingInstitutions.some((exisitingInst: any) => exisitingInst.instID === inst.instID)) {
          this.processedData.attendingInstitutions.push(inst);
        }
      }
    }

    //console.log(this.processedData.attendingInstitutions);

    for (let i of this.data.almanacRecord) {
      for (let inst of i.attendedBy) {
        if (!this.processedData.attendedBy.some((exisitingInst: any) => exisitingInst.instID === inst.instID)) {
          this.processedData.attendedBy.push(inst);
        }
      }
    }
  }

  onInstitutionClick(item: any): void{
    this.loading = true;
    this._api.getTypeRequest('institution/' + item.instID).subscribe((res: any) => {
      this.data = res;
      this.loading = false;
      this.processData();
    });
  }
}
