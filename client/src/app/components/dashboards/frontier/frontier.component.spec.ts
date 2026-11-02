import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ThemeService } from '../../../services/theme.service';

import { FrontierComponent } from './frontier.component';

describe('FrontierComponent', () => {
  let component: FrontierComponent;
  let fixture: ComponentFixture<FrontierComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), ThemeService],
      imports: [FrontierComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FrontierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
