import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ThemeService } from '../../../services/theme.service';

import { CenterPeripheryComponent } from './center-periphery.component';

describe('CenterPeripheryComponent', () => {
  let component: CenterPeripheryComponent;
  let fixture: ComponentFixture<CenterPeripheryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), ThemeService],
      imports: [CenterPeripheryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CenterPeripheryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
