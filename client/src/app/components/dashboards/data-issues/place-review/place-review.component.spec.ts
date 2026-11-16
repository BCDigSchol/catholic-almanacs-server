import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PlaceReviewComponent } from './place-review.component';

describe('PlaceReviewComponent', () => {
  let component: PlaceReviewComponent;
  let fixture: ComponentFixture<PlaceReviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([])],
      imports: [PlaceReviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlaceReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
