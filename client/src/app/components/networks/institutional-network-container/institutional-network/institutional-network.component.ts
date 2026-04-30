import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../../../services/api.service';
import { NetworkGraphComponent } from "../../../common/network-graph/network-graph.component";

@Component({
  selector: 'app-institutional-network',
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    NetworkGraphComponent
  ],
  templateUrl: './institutional-network.component.html',
  styleUrl: './institutional-network.component.scss'
})
export class InstitutionalNetworkComponent implements OnInit {
  @Input() initialState: string = '';
  @Input() initialCity: string = '';
  @Input() initialDiocese: string = '';
  loading: boolean = true;
  network: any = { nodes: [], edges: [] };
  networkOptions: any = {};

  // Filter fields
  state: string = '';
  city: string = '';
  diocese: string = '';
  startYear: number | null = null;
  endYear: number | null = null;

  usStates = [
    { abbr: '', name: 'All States' },
    { abbr: 'AL', name: 'Alabama' },
    { abbr: 'AK', name: 'Alaska' },
    { abbr: 'AZ', name: 'Arizona' },
    { abbr: 'AR', name: 'Arkansas' },
    { abbr: 'CA', name: 'California' },
    { abbr: 'CO', name: 'Colorado' },
    { abbr: 'CT', name: 'Connecticut' },
    { abbr: 'DE', name: 'Delaware' },
    { abbr: 'FL', name: 'Florida' },
    { abbr: 'GA', name: 'Georgia' },
    { abbr: 'HI', name: 'Hawaii' },
    { abbr: 'ID', name: 'Idaho' },
    { abbr: 'IL', name: 'Illinois' },
    { abbr: 'IN', name: 'Indiana' },
    { abbr: 'IA', name: 'Iowa' },
    { abbr: 'KS', name: 'Kansas' },
    { abbr: 'KY', name: 'Kentucky' },
    { abbr: 'LA', name: 'Louisiana' },
    { abbr: 'ME', name: 'Maine' },
    { abbr: 'MD', name: 'Maryland' },
    { abbr: 'MA', name: 'Massachusetts' },
    { abbr: 'MI', name: 'Michigan' },
    { abbr: 'MN', name: 'Minnesota' },
    { abbr: 'MS', name: 'Mississippi' },
    { abbr: 'MO', name: 'Missouri' },
    { abbr: 'MT', name: 'Montana' },
    { abbr: 'NE', name: 'Nebraska' },
    { abbr: 'NV', name: 'Nevada' },
    { abbr: 'NH', name: 'New Hampshire' },
    { abbr: 'NJ', name: 'New Jersey' },
    { abbr: 'NM', name: 'New Mexico' },
    { abbr: 'NY', name: 'New York' },
    { abbr: 'NC', name: 'North Carolina' },
    { abbr: 'ND', name: 'North Dakota' },
    { abbr: 'OH', name: 'Ohio' },
    { abbr: 'OK', name: 'Oklahoma' },
    { abbr: 'OR', name: 'Oregon' },
    { abbr: 'PA', name: 'Pennsylvania' },
    { abbr: 'RI', name: 'Rhode Island' },
    { abbr: 'SC', name: 'South Carolina' },
    { abbr: 'SD', name: 'South Dakota' },
    { abbr: 'TN', name: 'Tennessee' },
    { abbr: 'TX', name: 'Texas' },
    { abbr: 'UT', name: 'Utah' },
    { abbr: 'VT', name: 'Vermont' },
    { abbr: 'VA', name: 'Virginia' },
    { abbr: 'WA', name: 'Washington' },
    { abbr: 'WV', name: 'West Virginia' },
    { abbr: 'WI', name: 'Wisconsin' },
    { abbr: 'WY', name: 'Wyoming' }
  ];

  constructor(private _api: ApiService) { }

  ngOnInit(): void {
    if (this.initialState) {
      this.state = this.initialState;
    }
    if (this.initialCity) {
      this.city = this.initialCity;
    }
    if (this.initialDiocese) {
      this.diocese = this.initialDiocese;
    }
    this.fetchNetwork();
  }

  fetchNetwork(overrideStartYear?: number, overrideEndYear?: number): void {
    this.loading = true;
    const start = overrideStartYear ?? this.startYear;
    const end = overrideEndYear ?? this.endYear;
    let url = 'institution/network';
    const params: string[] = [];
    if (this.state) params.push('state=' + encodeURIComponent(this.state));
    if (this.city) params.push('city=' + encodeURIComponent(this.city));
    if (this.diocese) params.push('diocese=' + encodeURIComponent(this.diocese));
    if (start != null) params.push('startYear=' + start);
    if (end != null) params.push('endYear=' + end);
    if (params.length) url += '?' + params.join('&');
    this._api.getTypeRequest(url).subscribe((res: any) => {
      this.network = res;
      this.networkOptions = this.buildDioceseGroups(res.nodes);
      this.loading = false;
    });
  }

  onTimeWindowChange(event: { startYear: number; endYear: number }): void {
    this.startYear = event.startYear;
    this.endYear = event.endYear;
    this.fetchNetwork(event.startYear, event.endYear);
  }

  buildDioceseGroups(nodes: any[]): any {
    // Collect unique dioceses
    const dioceses = Array.from(new Set(nodes.map(n => n.diocese || n.group || 'Unknown')));
    // Assign a color to each diocese
    const palette = [
      '#1976d2', '#388e3c', '#fbc02d', '#d32f2f', '#7b1fa2', '#0288d1', '#c2185b', '#ffa000', '#388e3c', '#455a64', '#f57c00', '#0097a7', '#afb42b', '#5d4037', '#c62828', '#00897b', '#6d4c41', '#303f9f', '#7e57c2', '#0288d1', '#43a047', '#fbc02d', '#d84315', '#8e24aa', '#1976d2', '#cddc39', '#ffb300', '#e64a19', '#009688', '#607d8b', '#fbc02d', '#d32f2f', '#7b1fa2', '#0288d1', '#c2185b', '#ffa000', '#388e3c', '#455a64', '#f57c00', '#0097a7', '#afb42b', '#5d4037', '#c62828', '#00897b', '#6d4c41', '#303f9f', '#7e57c2', '#0288d1', '#43a047', '#fbc02d', '#d84315', '#8e24aa', '#1976d2', '#cddc39', '#ffb300', '#e64a19', '#009688', '#607d8b'
    ];
    const groups: any = {};
    dioceses.forEach((d, i) => {
      groups[d] = {
        color: { background: palette[i % palette.length], border: '#333' },
        borderWidth: 2,
        shape: 'dot'
      };
    });
    return { groups };
  }

}
