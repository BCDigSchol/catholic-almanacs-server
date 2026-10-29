import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapVisComponent } from './map-vis.component';
import { ThemeService } from '../../../services/theme.service';

describe('MapVisComponent', () => {
  let component: MapVisComponent;
  let fixture: ComponentFixture<MapVisComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapVisComponent],
      // provided by AppComponent in the app
      providers: [ThemeService]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MapVisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
