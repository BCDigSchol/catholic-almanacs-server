import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiService } from '../../services/api.service';
import { AlmanacScansService } from '../../services/almanac-scans.service';
import { ScanLink, ScanVolume } from '../../utils/almanac-scans';
import { PageHeaderComponent } from '../common/page-header/page-header.component';
import { ScanLinksComponent } from '../common/scan-links/scan-links.component';
import { SegmentOption, SegmentedComponent } from '../common/segmented/segmented.component';

interface VolumeRow extends ScanVolume {
  /** Whether the database holds records from this year's almanac. */
  held: boolean;
}

/** Every almanac volume the team has found online, year by year. */
@Component({
  selector: 'app-volumes',
  imports: [RouterLink, PageHeaderComponent, ScanLinksComponent, SegmentedComponent],
  templateUrl: './volumes.component.html',
  styleUrl: './volumes.component.scss'
})
export class VolumesComponent implements OnInit, OnDestroy {
  rows: VolumeRow[] = [];
  series: ScanLink[] = [];
  loaded = false;
  /** Years with records in the database; empty until (or unless) the API answers. */
  heldYears: number[] = [];
  readonly shows: SegmentOption<'all' | 'held'>[] = [
    { value: 'all', label: 'Every volume' },
    { value: 'held', label: 'Years in the database' },
  ];
  show: 'all' | 'held' = 'all';

  private volumes: ScanVolume[] = [];
  private subs: Subscription[] = [];

  constructor(private scans: AlmanacScansService, private api: ApiService) {}

  ngOnInit(): void {
    this.subs.push(this.scans.scans$.subscribe(s => {
      this.volumes = s.volumes;
      this.series = s.series;
      this.loaded = true;
      this.build();
    }));
    // which years the database holds (the browse list sends them with any page)
    this.subs.push(this.api.getTypeRequest('institution?size=1').pipe(catchError(() => of(null))).subscribe((res: any) => {
      this.heldYears = (res?.meta?.years ?? []).map(Number);
      this.build();
    }));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  setShow(show: 'all' | 'held'): void {
    this.show = show;
    this.build();
  }

  private build(): void {
    const held = new Set(this.heldYears);
    this.rows = this.volumes.map(v => ({ ...v, held: held.has(v.year) })).filter(r => this.show === 'all' || r.held);
  }
}
