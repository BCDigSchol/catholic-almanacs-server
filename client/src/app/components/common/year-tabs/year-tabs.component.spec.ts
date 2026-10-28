import { ComponentFixture, TestBed } from '@angular/core/testing';

import { YearTabsComponent } from './year-tabs.component';

describe('YearTabsComponent', () => {
  let component: YearTabsComponent;
  let fixture: ComponentFixture<YearTabsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [YearTabsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(YearTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
