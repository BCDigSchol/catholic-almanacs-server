import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';

import { PageHeaderComponent } from '../../common/page-header/page-header.component';
import { NavService, PageEntry } from '../../../services/nav.service';

interface PageGroup {
  label: string;
  pages: PageEntry[];
}

/** The pages listing at /pages, generated from the content files (pages.json), grouped by kind. */
@Component({
  selector: 'app-pages-index',
  imports: [RouterLink, PageHeaderComponent],
  templateUrl: './pages-index.component.html',
  styleUrl: './pages-index.component.scss'
})
export class PagesIndexComponent implements OnInit {
  groups: PageGroup[] = [];

  constructor(private nav: NavService, private title: Title) {}

  ngOnInit(): void {
    this.title.setTitle('Essays and Pages · Catholic Almanacs');
    this.nav.pages$.subscribe(pages => {
      const byKind = new Map<string, PageEntry[]>();
      for (const page of pages) {
        const kind = this.plural(page.kind || 'page');
        byKind.set(kind, [...(byKind.get(kind) ?? []), page]);
      }
      // essays first, then the rest alphabetically, plain pages last
      this.groups = [...byKind.entries()]
        .sort(([a], [b]) => (a === 'Essays' ? -1 : b === 'Essays' ? 1 : a === 'Pages' ? 1 : b === 'Pages' ? -1 : a.localeCompare(b)))
        .map(([label, pages]) => ({ label, pages }));
    });
  }

  private plural(kind: string): string {
    const word = kind.trim().toLowerCase();
    const plural = word.endsWith('y') ? word.slice(0, -1) + 'ies' : word.endsWith('s') ? word : word + 's';
    return plural.charAt(0).toUpperCase() + plural.slice(1);
  }
}
