import { ComponentFixture, TestBed } from '@angular/core/testing';

import { YearRangeComponent } from './year-range.component';

describe('YearRangeComponent', () => {
  let component: YearRangeComponent;
  let fixture: ComponentFixture<YearRangeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [YearRangeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(YearRangeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
