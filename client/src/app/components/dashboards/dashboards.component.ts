import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { PageHeaderComponent } from '../common/page-header/page-header.component';
import { ReviewAuthService } from '../../services/review-auth.service';

/** Shown only to signed-in editors (the server closes its data to everyone else). */
const EDITORS_ONLY = new Set(['/dashboards/data-issues']);

interface DashboardCard {
  link: string;
  icon: string;
  title: string;
  description: string;
}

interface DashboardGroup {
  title: string;
  subtitle: string;
  cards: DashboardCard[];
}

// "Explore on the Map" (/dashboards/explore) is deliberately not listed here;
// Data Issues only for signed-in editors.
@Component({
  selector: 'app-dashboards',
  imports: [RouterLink, MatIconModule, PageHeaderComponent],
  templateUrl: './dashboards.component.html',
  styleUrl: './dashboards.component.scss'
})
export class DashboardsComponent {
  private readonly signedIn = inject(ReviewAuthService).isSignedIn;
  readonly groups: DashboardGroup[] = ([
    {
      title: "Start here",
      subtitle: "One interactive board over the whole collection — click anything to filter everything.",
      cards: [
        {
          link: "/dashboards/overview",
          icon: "dashboard",
          title: "The Almanacs at a Glance",
          description: "A single unified view of every institution and person the almanacs recorded. Map, function and type breakdowns, diocese rankings, and a year timeline — all linked, so clicking any function, diocese, type, or year filters the entire board at once."
        },
        {
          link: "/dashboards/coverage",
          icon: "grid_on",
          title: "Coverage — the Shape of the Data",
          description: "A GitHub-style grid of which dioceses were recorded in which years, beside a binned map of where records concentrate — so you can see how thoroughly the almanacs documented the church across time and space."
        },
        {
          link: "/dashboards/data-issues",
          icon: "rule",
          title: "Data Issues",
          description: "What to check or correct: people recorded under two ids, institutions without a place, records outside their diocese's territory — with a review queue for likely duplicate people and downloads for the editors."
        }
      ]
    },
    {
      title: "Geography",
      subtitle: "Where the church was, and how it moved across the continent over time.",
      cards: [
        {
          link: "/dashboards/spread",
          icon: "public",
          title: "The Spread of the Church",
          description: "Press play and watch Catholic institutions bloom westward across the map year by year — and the church's geographic centre of gravity march with them."
        },
        {
          link: "/dashboards/diocese-tracker",
          icon: "map",
          title: "Diocese by Diocese",
          description: "Trace the spread of the church one jurisdiction at a time — a map coloured by diocese that you can play through the years or filter to a single see."
        },
        {
          link: "/dashboards/circuits",
          icon: "route",
          title: "Mission Circuits",
          description: "Where churches and missions had no priest of their own and were attended from another place — every circuit drawn as a line from the serving church, year by year, with the share of the church that was served from afar."
        },
        {
          link: "/dashboards/rails-rivers",
          icon: "train",
          title: "Rails, Rivers and Trails",
          description: "Did the church follow the trails and the water, then the railroad? How near each year's institutions stood to the railroads, canals, steamboat rivers and overland trails of that year, mapped and charted over time."
        },
        {
          link: "/dashboards/frontier",
          icon: "explore",
          title: "The Frontier",
          description: "The Church against the settled country, with the post office as the measure of settlement: institutions by distance to the nearest post office then open, the church before the post office or after it, and settled places with no church near."
        },
        {
          link: "/dashboards/languages",
          icon: "translate",
          title: "Languages and Congregations",
          description: "Where the almanacs marked German, French, Polish and Bohemian parishes, Native American missions and Black congregations — mapped year by year, each traced over time."
        },
        {
          link: "/dashboards/cessions",
          icon: "landscape",
          title: "Missions and Ceded Lands",
          description: "The Church set against the land cessions of the Native nations it lived among: missions on land a nation still held, parishes on land ceded only years before — year by year, with the treaties."
        },
        {
          link: "/dashboards/southwest",
          icon: "wb_sunny",
          title: "The Southwest",
          description: "The Church on land the United States took from Mexico, with Spanish-surnamed clergy, Spanish-named churches and congregations marked Spanish or Mexican, year by year."
        }
      ]
    },
    {
      title: "Change over time",
      subtitle: "How the church's institutions, and the people who served them, grew and shifted in shape.",
      cards: [
        {
          link: "/dashboards/composition",
          icon: "insights",
          title: "The Shape of the Church",
          description: "See how the mix of institutions — parishes, schools, hospitals, and charities — shifted across the almanac years, and who served them, down to the rank in each person's title."
        },
        {
          link: "/dashboards/comparison",
          icon: "bar_chart",
          title: "Comparing Places",
          description: "Set dioceses, states, or years side by side to compare how many institutions of each kind each one had, and how many people served them."
        },
        {
          link: "/dashboards/subset-vs-whole",
          icon: "trending_up",
          title: "A Part Against the Whole",
          description: "Track one order, diocese, or state against the national total of the same kind — institutions or the people serving them — to see who grew faster."
        },
        {
          link: "/dashboards/turnover",
          icon: "hourglass_empty",
          title: "Lifespans and Turnover",
          description: "How long institutions lasted once the almanacs listed them — churches against schools and charities — how many came and went each year, and how often clergy left their posts."
        },
        {
          link: "/dashboards/gender",
          icon: "diversity_3",
          title: "Who Ran It, Whom It Served",
          description: "The schools, academies, asylums, hospitals and religious houses by who ran them, women's congregations, men religious, clergy or lay teachers, and whether they took girls, boys or both."
        },
        {
          link: "/dashboards/means",
          icon: "balance",
          title: "Paying and Charity",
          description: "Class without a census: academies and select schools that took paying pupils, free schools, the charities and whom they took in, what churches were built of, and the few fees the almanacs print."
        }
      ]
    },
    {
      title: "Connections",
      subtitle: "Who served alongside whom, which institutions shared their clergy, and where clergy moved.",
      cards: [
        {
          link: "/dashboards/networks",
          icon: "hub",
          title: "Networks",
          description: "Explore how institutions connect through the people they shared or the clergy who moved between them, how people connect through the places they served together, and both together in one web — filter, cluster, and search by place, type, and year."
        },
        {
          link: "/dashboards/clergy-flows",
          icon: "swap_horiz",
          title: "Clergy Flows",
          description: "Where priests went when they moved between posts: arcs between the sees, which dioceses sent clergy to which, and which received more than they gave."
        },
        {
          link: "/dashboards/orders",
          icon: "groups",
          title: "Religious Orders",
          description: "Where the Jesuits, Redemptorists, Benedictines and the other orders served, year by year — mapped from their members' listings, with the orders compared over time."
        }
      ]
    }
  ] as DashboardGroup[]).map(g => ({ ...g, cards: g.cards.filter(c => this.signedIn || !EDITORS_ONLY.has(c.link)) }));
}
