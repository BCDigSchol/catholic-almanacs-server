import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { WriteComponent } from './write.component';

describe('WriteComponent', () => {
  let component: WriteComponent;
  let fixture: ComponentFixture<WriteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WriteComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(WriteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
