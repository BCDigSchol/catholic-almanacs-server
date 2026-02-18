import { Component, Input, OnInit, AfterViewInit, ViewChild, ElementRef, OnChanges, SimpleChanges,
  HostListener, ChangeDetectorRef
 } from '@angular/core';
 import { FormsModule } from '@angular/forms';
 import { CommonModule } from '@angular/common';
 import { MatIconModule} from '@angular/material/icon';
 import { MatFormFieldModule } from '@angular/material/form-field';
 import { MatInputModule } from '@angular/material/input';
 import { MatSelect } from '@angular/material/select';
 import { Router } from '@angular/router';
 import { Settings } from '../../../app.settings';
 import mapLibregl from 'maplibre-gl';

@Component({
  selector: 'app-map',
  imports: [FormsModule, CommonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelect],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements OnInit, AfterViewInit, OnChanges {
  @ViewChild('map', { static: false}) mapContainer!: ElementRef; // map refers to the hashtag, and mapContainer is the variable name used in the ts file
  @ViewChild('headerRef', { static: false}) headerRef!: ElementRef;
  @ViewChild('resizeBarRef', { static: false}) resizeBarRef!: ElementRef;
  @ViewChild('dropdownRef', { static: false}) dropdownRef!: ElementRef;

  @Input() data: any[] = [];
  @Input() options: {
    zoom?: number;
    mode?: 'normal' | 'heatmap' | 'cluster' | 'point';
    modeControl?: boolean;
    modeOptions?: any;
    center?: { lat: number; lng: number };
    size: { width: string; height: string };
  } = {
    zoom: 2,
    mode: 'normal',
    modeOptions: {},
    modeControl: false,
    size: { width: '100%', height: '400px' }
  };

  map: any = null;
  marker: any[] = [];
  multipleStyles: boolean = Array.isArray(Settings.mapTilesUrl);
  currentStyle: string = Array.isArray(Settings.mapTilesUrl) ? Settings.mapTilesUrl[0].url : Settings.mapTilesUrl;
  currentMode: string = 'normal';
  possibleModes = [
    { value: 'normal', label: 'Normal' },
    { value: 'heatmap', label: 'Heatmap' },
    { value: 'cluster', label: 'Cluster' },
    { value: 'point', label: 'Points' }
  ];
  loading: boolean = true;

  private isResizing: boolean = false;
  private startY: number = 0;
  private startHeight: number = 0;

  constructor(private router: Router, private cdr: ChangeDetectorRef) {
  }

  ngOnInit (): void {
    this.currentMode = this.options.mode || 'normal';
    this.loading = false;
  }

  ngAfterViewInit (): void {
    if (Array.isArray(Settings.mapTilesUrl)) {
      this.currentStyle = Settings.mapTilesUrl[0].url;
    } else {
      this.currentStyle = Settings.mapTilesUrl;
    }
    this.initializeMap();
    setTimeout(() => {
      this.setMapHeightToFillScreen();
      this.updateMapCenter();
      this.cdr.detectChanges();
    })
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;
    if (changes['data'] && Array.isArray(this.data) && this.data.length > 0) {
      this.updateMapCenter();
    };
    this.currentMode = this.options.mode || 'normal';
    this.renderMapFeatures();
  }

  changeMapStyle(styleUrl: string): void { // the url that points to the map server
    this.currentStyle = styleUrl;
    if (this.map) {
      this.map.setStyle(this.currentStyle);
      this.map.once('styledata', () => {
        this.renderMapFeatures();
      });
    }
  }

  resetMap(): void {
    this.removeAllMarkers();
    this.renderMapFeatures();
  }

  initializeMap(): void {
    if (!this.mapContainer?.nativeElement) { // check if the html element exists
      console.warn('Map container not found');
      return;
    };
    if (this.map) { // check if the javascript map object exists
      this.map.remove(); // clear everything related to the map
      this.map = null;
    }
    this.map = new mapLibregl.Map({
      container: this.mapContainer.nativeElement,
      style: this.currentStyle,
      center: this.options.center ? [this.options.center.lng, this.options.center.lat] : [0, 0],
      zoom: this.options.zoom || 2,
      renderWorldCopies: false, // when zooming out, do not show multiple copies of the world
      attributionControl: false,
    })
    .addControl(new mapLibregl.NavigationControl())
    .addControl(new mapLibregl.FullscreenControl())
    .addControl(new mapLibregl.ScaleControl({maxWidth: 80, unit: 'metric'}))
    .addControl(new mapLibregl.AttributionControl({ customAttribution: Settings.mapTilesAttribution, compact: true }))
    .addControl(new mapLibregl.GlobeControl());
    this.map.on('load', () => {
      this.renderMapFeatures();
    })
  }

  renderMapFeatures(): void {
    this.removeMapLayersAndSources();
    this.removeAllMarkers();
    const features = this.data
      .filter(item => item.latitude && item.longitude)
      .map(item =>({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [item.longitude, item.latitude] },
        properties: {}
      }))
  }

  removeAllMarkers(): void {

  }

  setMapHeightToFillScreen(): void {
    const headerWeight = this.headerRef?.nativeElement?.offsetHeight || 0;
    const resizeBarHeight = this.resizeBarRef?.nativeElement?.offsetHeight || 0;
    const dropdownHeight = this.dropdownRef?.nativeElement?.offsetHeight || 0;
    const paddingHeight = 242;
    const totalOffset = headerWeight + resizeBarHeight + dropdownHeight + paddingHeight;
    this.options.size.height = `calc(100vh - ${totalOffset}px)`; // css class
    if (this.mapContainer?.nativeElement) {
      this.mapContainer.nativeElement.style.height = this.options.size.height;
    };
    if (this.map) {
      this.map.resize();
    }
  }

  updateMapCenter(): void {
    const center = this.options.center ? this.options.center : this.getCenterFromData();
    const zoom = this.options.zoom ? this.options.zoom : this.getAutoZoomLevel();
    if (center) {
      this.options.center = center;
      this.map.setCenter([center.lng, center.lat]);
      if (zoom) {
        this.map.setZoom(zoom);
      }
    }
  }

  getCenterFromData () {

  }

  getAutoZoomLevel () {

  }

  removeMapLayersAndSources(): void {
  }
}
