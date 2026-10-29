import { ComponentFixture, TestBed } from '@angular/core/testing';

import { YearPlayerComponent } from './year-player.component';

describe('YearPlayerComponent', () => {
  let component: YearPlayerComponent;
  let fixture: ComponentFixture<YearPlayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [YearPlayerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(YearPlayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
