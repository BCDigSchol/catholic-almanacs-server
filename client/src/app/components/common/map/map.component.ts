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

  constructor(private router: Router) {
   }

  ngAfterViewInit() {
    this.initializeMap();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] && this.map) {
      this.updateMarkers();
    }
  }

  initializeMap() {
    if (this.map) {
      this.map.remove();
    };
    this.map = L.map(this.leafletMap.nativeElement).setView([this.options.center.lat, this.options.center.lng], this.options.zoom);
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'marker-icon-2x.png',
      iconUrl: 'marker-icon.png',
      shadowUrl: 'marker-shadow.png',
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
    for (let item of dataArray) {
      if (item.latitude && item.longitude) {
        if (item.color) { // if color option is specified, then the marker should be circle -- everything map
        const circle = L.circle([item.latitude, item.longitude], {
          color: item.color,
          fillColor: item.color,
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
      else {
        //console.log(item);
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
      }}
    }
  }
}
