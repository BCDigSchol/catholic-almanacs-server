import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/**
 * `<almanac-embed src="/dashboards/overview?year=1850" height="560"
 * caption="…">`: a dashboard, map or record page of this site embedded in a
 * content page in the state its address gives (`?embed=true` is added, which
 * hides the site header). `lazy` shows a button and loads on click.
 */
@Component({
  selector: 'app-embed',
  imports: [],
  templateUrl: './embed.component.html',
  styleUrl: './embed.component.scss'
})
export class EmbedComponent implements OnChanges {
  @Input() src = '';
  @Input() height: string | number = 560;
  @Input() caption = '';
  @Input() title = '';
  /** Any value but "false": load only when asked. */
  @Input() lazy: string | boolean = false;

  url: SafeResourceUrl | null = null;
  fullUrl = '';
  loaded = false;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    const path = (this.src || '').trim();
    if (!path) { this.url = null; return; }
    // only this site's own pages: a path, never another origin
    const clean = path.startsWith('/') ? path : `/${path.replace(/^https?:\/\/[^/]+/, '')}`;
    this.fullUrl = clean;
    const embedded = clean.includes('?') ? `${clean}&embed=true` : `${clean}?embed=true`;
    this.url = this.sanitizer.bypassSecurityTrustResourceUrl(embedded);
    this.loaded = !(this.lazy && this.lazy !== 'false');
  }

  get frameHeight(): string {
    const h = String(this.height || 560);
    return /^\d+$/.test(h) ? `${h}px` : h;
  }
}
