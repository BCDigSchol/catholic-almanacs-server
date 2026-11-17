import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScanLinksComponent } from './scan-links.component';

describe('ScanLinksComponent', () => {
  let component: ScanLinksComponent;
  let fixture: ComponentFixture<ScanLinksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScanLinksComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScanLinksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('names each library as a link, with its note', () => {
    fixture.componentRef.setInput('links', [
      { library: 'HathiTrust', url: 'https://babel.hathitrust.org/cgi/pt?id=x', note: 'begins page 324' },
      { library: 'Internet Archive', url: 'https://archive.org/details/x', note: '' },
    ]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect([...el.querySelectorAll('a')].map(a => a.textContent)).toEqual(['HathiTrust', 'Internet Archive']);
    expect(el.textContent!.replace(/\s+/g, ' ').trim()).toBe('HathiTrust (begins page 324) · Internet Archive');
  });
});
