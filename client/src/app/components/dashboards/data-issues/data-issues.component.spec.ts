import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { DataIssuesComponent } from './data-issues.component';

describe('DataIssuesComponent', () => {
  let component: DataIssuesComponent;
  let fixture: ComponentFixture<DataIssuesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      imports: [DataIssuesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DataIssuesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
