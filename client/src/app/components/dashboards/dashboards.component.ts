import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { PageHeaderComponent } from '../common/page-header/page-header.component';

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

// "Explore on the Map" (/dashboards/explore) is deliberately not listed here.
@Component({
  selector: 'app-dashboards',
  imports: [RouterLink, MatIconModule, PageHeaderComponent],
  templateUrl: './dashboards.component.html',
  styleUrl: './dashboards.component.scss'
})
export class DashboardsComponent {
  readonly groups: DashboardGroup[] = [
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
          title: "Rails and Rivers",
          description: "Did the church follow the water, then the railroad? How near each year's institutions stood to the railroads, canals and steamboat rivers of that year, mapped and charted over time."
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
  ];
}
