import { Component, SimpleChanges } from '@angular/core';
import { Input } from '@angular/core';
import { AfterViewInit } from '@angular/core'; // use AfterViewInit instead of OnInit for non-Angular libraries
import { OnChanges } from '@angular/core';
import { ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';

import * as L from 'leaflet';

@Component({
  selector: 'app-map',
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})

export class MapComponent implements AfterViewInit, OnChanges {
  @ViewChild('leafletMap', { static: false }) private leafletMap!: ElementRef<HTMLDivElement>;
  @Input() data: any[] = [];
  @Input() colorMode: 'diocese' | 'function' = 'function';
  @Input() markerMode: 'icon' | 'circle' = 'icon';
  @Input() options: {
    zoom: number,
    center: { lat: number; lng: number },
    size: { width: string; height: string }
  } = {
    zoom: 4,
    center: { lat: 40, lng: -80 },
    size: { width: '100%', height: '400px' }
  };
  map: any = null;
  loading: boolean = true;
  private markers: L.Layer[] = [];
  private dioceseColorMap: { [key: string]: string } = {};

  constructor(private router: Router) {
    this.initDioceseColorMap();
   }

  ngAfterViewInit() {
    this.initializeMap();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] && this.map) {
      this.updateMarkers();
    }
  }

  private initDioceseColorMap() {
    const colorPalette = [
      '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33',
      '#a65628', '#f781bf', '#999999', '#1b9e77', '#d95f02', '#7570b3',
      '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#666666',
    ];
    const dioceseList = [
      'Albany', 'Alton', 'Baltimore', 'Bardstown', 'Boston', 'Brooklyn', 'Buffalo', 'Burlington',
      'Charleston', 'Chicago', 'Cincinnati', 'Cleveland', 'Columbus', 'Covington', 'Detroit', 'Dubuque',
      'Erie', 'FortWayne', 'Galveston', 'GrassValley', 'GreenBay', 'Harrisburg', 'Hartford', 'LaCrosse',
      'LittleRock', 'Louisville', 'Marquette', 'Milwaukee', 'Mobile', 'Monterey', 'Nashville', 'Natchez',
      'Natchitoches', 'Nesqualy', 'NewOrleans', 'NewYorkCity', 'Newark', 'OregonCity', 'Philadelphia',
      'Pittsburgh', 'Portland', 'Richmond', 'Rochester', 'SanFrancisco', 'SantaFe', 'Savannah', 'Scranton',
      'StJoseph', 'StLouis', 'StPaul', 'VAColoradoUtah', 'VAFlorida', 'VAIdaho', 'VAKansas',
      'VAMarysvilleCalifornia', 'VANebraska', 'VANorthCarolina', 'Vincennes', 'Wheeling', 'Wilmington'
    ];
    const normalized = (name: string) => name.replace(/\s+/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
    dioceseList.forEach((d, i) => {
      this.dioceseColorMap[normalized(d)] = colorPalette[i % colorPalette.length];
    });
  }

  getCircleColor(value: string): string {
    if (this.colorMode === 'diocese') {
      const normalized = (name: string) => name.replace(/\s+/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
      return this.dioceseColorMap[normalized(value)] || '#FFFFFF';
    } else {
      // Function-based coloring
      const colorMap: { [key: string]: string } = {
        'consecrated life institutions': '#FF0000',
        'religious institutions': '#e0be24a2',
        'educational institutions': '#b300ffff',
        'healthcare institutions': '#0000FF',
        'charitable institutions': '#00FF00',
      };
      return colorMap[value] || '#FFFFFF';
    }
  }

  initializeMap() {
    if (this.map) {
      this.map.remove();
    };
    this.map = L.map(this.leafletMap.nativeElement).setView([this.options.center.lat, this.options.center.lng], this.options.zoom);
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '../marker-icon-2x.png',
      iconUrl: '../marker-icon.png',
      shadowUrl: '../marker-shadow.png',
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.loading = false;
    //console.log(this.data);
    this.updateMarkers();
  }

  updateMarkers() {
    this.markers.forEach(marker => this.map.removeLayer(marker));
    this.markers = [];

    const dataArray = Array.isArray(this.data) ? this.data : [this.data];
    if (this.markerMode === 'icon') {
      //console.log(this.data);
      for (let item of dataArray) {
        if (item.latitude && item.longitude) {
          const marker = L.marker([item.latitude, item.longitude])
            .addTo(this.map)
            .on('click', () => {
              console.log(item);
              if (item.id) {
                this.router.navigate(['/institutions', item.id]);
              }
              if (item.instID) {
                this.router.navigate(['/institutions', item.instID]);
              }
            });
            /*.on('mouseover', () => {
              console.log(item.instName);
              marker.bindTooltip(item.instName || '', { permanent: false, direction: 'top', offset: L.point(0, -20) }).openTooltip();
            });*/
          marker.bindTooltip(item.instName || '', { permanent: false, direction: 'top' });
          this.markers.push(marker);
        }
        }
    }
    else {
      for (let item of dataArray) {
        if (item.latitude && item.longitude) {
          if (this.colorMode === 'function') {
          const circle = L.circle([item.latitude, item.longitude], {
            color: this.getCircleColor(item.instFunction),
            fillColor: this.getCircleColor(item.instFunction),
            fillOpacity: 0.5,
            radius: 30,
          })
          .addTo(this.map)
          .on('click', () => {
            if (item.instID) {
              this.router.navigate(['/institutions', item.instID]);
            }
            if (item.id) {
              this.router.navigate(['/institutions', item.id]);
            }
          });
          circle.bindTooltip(item.instName || '', { permanent: false, direction: 'top' });
          this.markers.push(circle);}
          else if (this.colorMode === 'diocese') {
            const circle = L.circle([item.latitude, item.longitude], {
            color: this.getCircleColor(item.diocese),
            fillColor: this.getCircleColor(item.diocese),
            fillOpacity: 0.5,
            radius: 30,
          })
          .addTo(this.map)
          .on('click', () => {
            if (item.instID) {
              this.router.navigate(['/institutions', item.instID]);
            }
            if (item.id) {
              this.router.navigate(['/institutions', item.id]);
            }
          });
          circle.bindTooltip(item.instName || '', { permanent: false, direction: 'top' });
          this.markers.push(circle);}
        }
      }
    }
  }
}
