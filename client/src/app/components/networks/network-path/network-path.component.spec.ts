import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { NetworkPathComponent, yearSpans } from './network-path.component';

describe('NetworkPathComponent', () => {
  let component: NetworkPathComponent;
  let fixture: ComponentFixture<NetworkPathComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      imports: [NetworkPathComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NetworkPathComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('collapses runs of years', () => {
    expect(yearSpans([1869, 1864, 1865, 1866])).toBe('1864–66, 1869');
    expect(yearSpans([1838])).toBe('1838');
  });
});
