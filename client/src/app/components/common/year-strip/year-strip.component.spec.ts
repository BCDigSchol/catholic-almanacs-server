import { ComponentFixture, TestBed } from '@angular/core/testing';

import { YearStripComponent } from './year-strip.component';

describe('YearStripComponent', () => {
  let component: YearStripComponent;
  let fixture: ComponentFixture<YearStripComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [YearStripComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(YearStripComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
