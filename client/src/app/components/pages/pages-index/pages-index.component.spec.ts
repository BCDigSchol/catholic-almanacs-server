import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { PagesIndexComponent } from './pages-index.component';

describe('PagesIndexComponent', () => {
  let component: PagesIndexComponent;
  let fixture: ComponentFixture<PagesIndexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PagesIndexComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(PagesIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
