import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ThemeService } from '../../../services/theme.service';

import { ClergyFlowsComponent } from './clergy-flows.component';

describe('ClergyFlowsComponent', () => {
  let component: ClergyFlowsComponent;
  let fixture: ComponentFixture<ClergyFlowsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), ThemeService],
      imports: [ClergyFlowsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClergyFlowsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
