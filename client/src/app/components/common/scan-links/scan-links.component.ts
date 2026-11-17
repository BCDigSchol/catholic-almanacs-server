import { Component, Input } from '@angular/core';

import { ScanLink } from '../../../utils/almanac-scans';

/** The libraries where one almanac volume can be read online, as a run of links. */
@Component({
  selector: 'app-scan-links',
  imports: [],
  templateUrl: './scan-links.component.html',
  styleUrl: './scan-links.component.scss'
})
export class ScanLinksComponent {
  @Input() links: ScanLink[] = [];
}
