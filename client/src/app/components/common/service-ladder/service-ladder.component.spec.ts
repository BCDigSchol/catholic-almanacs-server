import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ServiceLadderComponent } from './service-ladder.component';

describe('ServiceLadderComponent', () => {
  let component: ServiceLadderComponent;
  let fixture: ComponentFixture<ServiceLadderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([])],
      imports: [ServiceLadderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ServiceLadderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
