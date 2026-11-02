import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LinkReviewComponent } from './link-review.component';

describe('LinkReviewComponent', () => {
  let component: LinkReviewComponent;
  let fixture: ComponentFixture<LinkReviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([])],
      imports: [LinkReviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LinkReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
