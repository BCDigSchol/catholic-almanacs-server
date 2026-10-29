import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VizPanelComponent } from './viz-panel.component';

describe('VizPanelComponent', () => {
  let component: VizPanelComponent;
  let fixture: ComponentFixture<VizPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VizPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VizPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
