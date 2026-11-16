import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { LineageNetworkComponent } from './lineage-network.component';

describe('LineageNetworkComponent', () => {
  let component: LineageNetworkComponent;
  let fixture: ComponentFixture<LineageNetworkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      imports: [LineageNetworkComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LineageNetworkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
