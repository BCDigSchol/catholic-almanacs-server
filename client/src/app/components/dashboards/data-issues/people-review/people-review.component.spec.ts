import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { PeopleReviewComponent } from './people-review.component';

describe('PeopleReviewComponent', () => {
  let component: PeopleReviewComponent;
  let fixture: ComponentFixture<PeopleReviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      imports: [PeopleReviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PeopleReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
