import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { InstitutionalNetworkContainerComponent } from './institutional-network-container.component';

describe('InstitutionalNetworkContainerComponent', () => {
  let component: InstitutionalNetworkContainerComponent;
  let fixture: ComponentFixture<InstitutionalNetworkContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      imports: [InstitutionalNetworkContainerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstitutionalNetworkContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
