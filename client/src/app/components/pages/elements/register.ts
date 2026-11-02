import { Injector } from '@angular/core';
import { createCustomElement } from '@angular/elements';

import { RecordCardComponent } from './record-card/record-card.component';
import { EmbedComponent } from './embed/embed.component';

/**
 * The custom tags content pages may use, defined once at start-up:
 *   <almanac-record record="alb.ny.0001" year="1850">
 *   <almanac-embed src="/dashboards/overview?year=1850" height="560" caption="…">
 * They work inside page HTML that Angular never compiles (innerHTML).
 */
export function defineAlmanacElements(injector: Injector): void {
  const define = (tag: string, component: any) => {
    if (!customElements.get(tag)) customElements.define(tag, createCustomElement(component, { injector }));
  };
  define('almanac-record', RecordCardComponent);
  define('almanac-embed', EmbedComponent);
}
