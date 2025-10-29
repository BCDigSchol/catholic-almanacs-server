import { Component, SimpleChanges } from '@angular/core';
import { Input } from '@angular/core';
import { AfterViewInit } from '@angular/core'; // use AfterViewInit instead of OnInit for non-Angular libraries
import { OnChanges } from '@angular/core';
import { ViewChild, ElementRef } from '@angular/core';

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

  ngAfterViewInit() {
    this.initializeMap();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] && this.map) {
      this.updateMarkers();
    }
  }

  getCircleColor (type: string) : string {
    const colorMap : { [key: string] : string} = {
      'consecrated life institutions': '#FF0000', // red
      'religious institutions': '#e0be24a2', // yellow
      'educational institutions': '#b300ffff', // orange
      'healthcare institutions': '#0000FF', // blue
      'charitable institutions': '#00FF00', // green
    };
    return colorMap[type] || '#FFFFFF'; // default to white if type not found
  };

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
  }

  updateMarkers() {
    const dataArray = Array.isArray(this.data) ? this.data : [this.data];
    if (this.markerMode === 'icon') {
      for (let item of dataArray) {
        if (item.latitude && item.longitude) {
          L.marker([item.latitude, item.longitude]).addTo(this.map)
        }
        }
    }
    else {
      for (let item of dataArray) {
        if (item.latitude && item.longitude) {
          L.circle([item.latitude, item.longitude], {
            color: this.getCircleColor(item.instFunction),
            fillColor: this.getCircleColor(item.instFunction),
            fillOpacity: 0.5,
            radius: 100,
          }).addTo(this.map);
        }
      }
    }
  }
}
