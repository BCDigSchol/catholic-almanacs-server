import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapTemplateComponentComponent } from './map-template.component.component';

describe('MapTemplateComponentComponent', () => {
  let component: MapTemplateComponentComponent;
  let fixture: ComponentFixture<MapTemplateComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapTemplateComponentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MapTemplateComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
