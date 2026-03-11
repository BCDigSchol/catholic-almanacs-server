import { Component, ContentChild, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

@Component({
  selector: 'app-map-template.component',
  imports: [NgTemplateOutlet],
  templateUrl: './map-template.component.component.html',
  styleUrl: './map-template.component.component.scss'
})
export class MapTemplateComponentComponent {
  @ContentChild('filter', {static: true}) filter!: TemplateRef<any>;
  @ContentChild('mapName', {static: true}) mapName!: TemplateRef<any>;
  @ContentChild('map', {static: true}) map!: TemplateRef<any>;
  isMobile: boolean = false;
}
