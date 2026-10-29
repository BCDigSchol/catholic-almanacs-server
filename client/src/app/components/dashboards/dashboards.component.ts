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

// "Explore Institutions/People on the Map" (/dashboards/explore-institutions,
// /dashboards/explore-people) are deliberately not listed here.
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
          description: "A single unified view of every institution the almanacs recorded. Map, function and type breakdowns, diocese rankings, and a year timeline — all linked, so clicking any function, diocese, type, or year filters the entire board at once."
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
        }
      ]
    },
    {
      title: "Institutions",
      subtitle: "How the network of Catholic institutions grew and shifted in shape.",
      cards: [
        {
          link: "/dashboards/composition",
          icon: "insights",
          title: "The Shape of the Church",
          description: "See how the mix of institutions — parishes, schools, hospitals, and charities — shifted across the almanac years."
        },
        {
          link: "/dashboards/comparison",
          icon: "bar_chart",
          title: "Comparing Places",
          description: "Set dioceses, states, or years side by side to compare how many institutions of each kind each one had."
        },
        {
          link: "/dashboards/subset-vs-whole",
          icon: "trending_up",
          title: "A Part Against the Whole",
          description: "Track one order, diocese, or state against the national total of the same kind to see who grew faster."
        },
        {
          link: "/dashboards/network-institutions",
          icon: "hub",
          title: "The Institution Network",
          description: "Explore how institutions connect through the people they shared — an interactive web you can filter, cluster, and search by place, type, and year."
        }
      ]
    },
    {
      title: "People",
      subtitle: "The clergy and religious behind those institutions, across time.",
      cards: [
        {
          link: "/dashboards/people-composition",
          icon: "groups",
          title: "Who Served the Church",
          description: "See the makeup of Catholic personnel over time by the kind of institution — parish, school, hospital, charity — they served."
        },
        {
          link: "/dashboards/clergy-hierarchy",
          icon: "church",
          title: "The Shape of the Clergy",
          description: "Watch the hierarchy grow — archbishops, bishops, vicars, and priests — by the rank in each person's title."
        },
        {
          link: "/dashboards/people-comparison",
          icon: "diversity_3",
          title: "Comparing People",
          description: "Set places and years side by side to compare how many people served institutions of each kind."
        },
        {
          link: "/dashboards/people-subset-vs-whole",
          icon: "moving",
          title: "People: A Part Against the Whole",
          description: "Track the people serving one order, diocese, or state against the national total serving the same kind of institution."
        },
        {
          link: "/dashboards/network-people",
          icon: "share",
          title: "The People Network",
          description: "See how people connect through the institutions they served together — an interactive web of shared service across the church."
        },
        {
          link: "/dashboards/network-service",
          icon: "account_tree",
          title: "People Serving Institutions",
          description: "People and institutions together in one web, linked by who served where — the connective tissue between the two."
        }
      ]
    }
  ];
}
