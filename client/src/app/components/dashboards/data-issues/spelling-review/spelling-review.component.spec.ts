import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SpellingReviewComponent } from './spelling-review.component';

describe('SpellingReviewComponent', () => {
  let component: SpellingReviewComponent;
  let fixture: ComponentFixture<SpellingReviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([])],
      imports: [SpellingReviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SpellingReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
