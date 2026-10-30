import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ThemeService } from '../../../services/theme.service';

import { RailsRiversComponent } from './rails-rivers.component';

describe('RailsRiversComponent', () => {
  let component: RailsRiversComponent;
  let fixture: ComponentFixture<RailsRiversComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), ThemeService],
      imports: [RailsRiversComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RailsRiversComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
