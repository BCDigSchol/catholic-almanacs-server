import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-institution-details',
  imports: [CommonModule],
  templateUrl: './institution-details.component.html',
  styleUrl: './institution-details.component.scss'
})
export class InstitutionDetailsComponent implements OnInit {
  loading = true;
  itemId: any;
  data: any[] = [];

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
    }
    );
  }
}
