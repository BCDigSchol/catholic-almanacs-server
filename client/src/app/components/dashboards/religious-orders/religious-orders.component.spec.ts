import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ThemeService } from '../../../services/theme.service';

import { ReligiousOrdersComponent } from './religious-orders.component';

describe('ReligiousOrdersComponent', () => {
  let component: ReligiousOrdersComponent;
  let fixture: ComponentFixture<ReligiousOrdersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), ThemeService],
      imports: [ReligiousOrdersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReligiousOrdersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
