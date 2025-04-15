import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrowseInstitutionComponent } from './browse-institution.component';

describe('BrowseInstitutionComponent', () => {
  let component: BrowseInstitutionComponent;
  let fixture: ComponentFixture<BrowseInstitutionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrowseInstitutionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BrowseInstitutionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
