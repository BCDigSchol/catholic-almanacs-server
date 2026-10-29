import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';

import { ApiService } from '../../../services/api.service';
import { HeaderSearchComponent } from '../../common/header-search/header-search.component';

interface Kpis {
  institutions: number;
  people: number;
  dioceses: number;
  yearMin: number;
  yearMax: number;
}

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, HeaderSearchComponent],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
})
export class HomePageComponent implements OnInit {
  /** Embedded in another site (?embed=true): links open in a new tab. */
  isEmbedded = false;
  kpis?: Kpis;

  constructor(private api: ApiService, private route: ActivatedRoute, private title: Title) {}

  ngOnInit(): void {
    this.title.setTitle('Catholic Almanacs Database');
    this.route.queryParamMap.subscribe(params => {
      this.isEmbedded = params.get('embed') === 'true';
    });
    // The overview's unfiltered totals: distinct institutions and people across all years.
    this.api.postTypeRequest('stats/overview', { entity: 'institutions', years: [], functions: [], types: [], dioceses: [] })
      .subscribe({ next: (res: any) => this.kpis = res.kpis, error: () => this.kpis = undefined });
  }

  get linkTarget(): string {
    return this.isEmbedded ? '_blank' : '_self';
  }

  format(n: number | null | undefined): string {
    return n == null ? '—' : n.toLocaleString();
  }
}
