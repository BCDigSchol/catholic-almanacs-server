import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { PersonalNetworkContainerComponent } from './personal-network-container.component';

describe('PersonalNetworkContainerComponent', () => {
  let component: PersonalNetworkContainerComponent;
  let fixture: ComponentFixture<PersonalNetworkContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      imports: [PersonalNetworkContainerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PersonalNetworkContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
