import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { NetworkFocusComponent } from './network-focus.component';

describe('NetworkFocusComponent', () => {
  let component: NetworkFocusComponent;
  let fixture: ComponentFixture<NetworkFocusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
      imports: [NetworkFocusComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NetworkFocusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
