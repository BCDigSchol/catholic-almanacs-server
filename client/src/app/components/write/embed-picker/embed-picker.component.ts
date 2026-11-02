import { Component, ElementRef, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface EmbedPick {
  src: string;
  height: string;
  caption: string;
  lazy: boolean;
}

/** The site's dashboards and record pages, by the address each keeps its state in. */
const VIEWS: { title: string; link: string }[] = [
  { title: 'The Almanacs at a Glance', link: '/dashboards/overview' },
  { title: 'Coverage — the Shape of the Data', link: '/dashboards/coverage' },
  { title: 'The Spread of the Church', link: '/dashboards/spread' },
  { title: 'Diocese by Diocese', link: '/dashboards/diocese-tracker' },
  { title: 'Mission Circuits', link: '/dashboards/circuits' },
  { title: 'Rails, Rivers and Trails', link: '/dashboards/rails-rivers' },
  { title: 'The Frontier', link: '/dashboards/frontier' },
  { title: 'Center and Periphery', link: '/dashboards/center-periphery' },
  { title: 'Languages and Congregations', link: '/dashboards/languages' },
  { title: 'Missions and Ceded Lands', link: '/dashboards/cessions' },
  { title: 'The Southwest', link: '/dashboards/southwest' },
  { title: 'The Shape of the Church', link: '/dashboards/composition' },
  { title: 'Comparing Places', link: '/dashboards/comparison' },
  { title: 'A Part Against the Whole', link: '/dashboards/subset-vs-whole' },
  { title: 'Lifespans and Turnover', link: '/dashboards/turnover' },
  { title: 'Who Ran It, Whom It Served', link: '/dashboards/gender' },
  { title: 'Paying and Charity', link: '/dashboards/means' },
  { title: 'Networks', link: '/dashboards/networks' },
  { title: 'Clergy Flows', link: '/dashboards/clergy-flows' },
  { title: 'Religious Orders', link: '/dashboards/orders' },
  { title: 'Explore on the Map', link: '/dashboards/explore' },
];

/**
 * Picks a view to embed: open a dashboard here, set it up (every control
 * writes the address), and keep the address it reaches. Any page of the
 * site works, pasted as a path.
 */
@Component({
  selector: 'app-embed-picker',
  imports: [FormsModule],
  templateUrl: './embed-picker.component.html',
  styleUrl: './embed-picker.component.scss'
})
export class EmbedPickerComponent implements OnInit {
  @Output() picked = new EventEmitter<EmbedPick>();
  @Output() closed = new EventEmitter<void>();
  @ViewChild('frame') frame?: ElementRef<HTMLIFrameElement>;

  readonly views = VIEWS;
  path = '/dashboards/overview';
  frameUrl: SafeResourceUrl | null = null;
  height = '560';
  caption = '';
  lazy = false;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.open(this.path);
  }

  open(path: string): void {
    this.path = path;
    const clean = path.startsWith('/') ? path : `/${path}`;
    this.frameUrl = this.sanitizer.bypassSecurityTrustResourceUrl(clean.includes('?') ? `${clean}&embed=true` : `${clean}?embed=true`);
  }

  /** The address the view inside the frame has reached, without the embed flag. */
  private currentPath(): string {
    try {
      const loc = this.frame?.nativeElement.contentWindow?.location;
      if (loc && loc.pathname) {
        const params = new URLSearchParams(loc.search);
        params.delete('embed');
        const query = params.toString();
        return loc.pathname + (query ? `?${query}` : '');
      }
    } catch { /* another origin: keep what was typed */ }
    return this.path;
  }

  use(): void {
    this.picked.emit({ src: this.currentPath(), height: this.height || '560', caption: this.caption.trim(), lazy: this.lazy });
  }
}
