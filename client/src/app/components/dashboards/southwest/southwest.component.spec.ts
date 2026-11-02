import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ThemeService } from '../../../services/theme.service';

import { SouthwestComponent } from './southwest.component';

describe('SouthwestComponent', () => {
  let component: SouthwestComponent;
  let fixture: ComponentFixture<SouthwestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), ThemeService],
      imports: [SouthwestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SouthwestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
