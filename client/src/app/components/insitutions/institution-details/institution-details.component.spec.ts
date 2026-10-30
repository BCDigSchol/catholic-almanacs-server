import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { InstitutionDetailsComponent } from './institution-details.component';

describe('InstitutionDetailsComponent', () => {
  let component: InstitutionDetailsComponent;
  let fixture: ComponentFixture<InstitutionDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      imports: [InstitutionDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstitutionDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
