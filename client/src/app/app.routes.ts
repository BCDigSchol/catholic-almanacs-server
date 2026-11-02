import { inject } from '@angular/core';
import { RedirectFunction, Router, Routes } from '@angular/router';

import { HomeComponent } from './components/home/home.component';
import { NotFoundComponent } from './components/common/not-found/not-found.component';

/** Redirects to `path` with extra query params, keeping any the old link carried. */
function redirectWith(path: string, params: Record<string, string>): RedirectFunction {
    return ({ queryParams }) => inject(Router).createUrlTree([path], { queryParams: { ...queryParams, ...params } });
}

// Heavy feature areas (vis-network, d3, MapLibre) are lazy-loaded
// so the initial bundle stays small.
export const routes: Routes = [
    { path: '', component: HomeComponent },
    // About is an editable content page: client/public/page-content/about.md
    { path: 'about', redirectTo: 'pages/about' },
    // One Browse page for both lists; filters, sort and page live in the query string.
    { path: 'institutions', data: { entity: 'institutions' }, loadComponent: () => import('./components/browse/browse.component').then(m => m.BrowseComponent) },
    { path: 'institutions/:id', loadComponent: () => import('./components/insitutions/institution-details/institution-details.component').then(m => m.InstitutionDetailsComponent) },
    { path: 'people', data: { entity: 'people' }, loadComponent: () => import('./components/browse/browse.component').then(m => m.BrowseComponent) },
    { path: 'people/:id', loadComponent: () => import('./components/people/person-details/person-details.component').then(m => m.PersonDetailsComponent) },
    { path: 'dashboards', loadComponent: () => import('./components/dashboards/dashboards.component').then(m => m.DashboardsComponent) },
    { path: 'dashboards/overview', loadComponent: () => import('./components/dashboards/overview/overview.component').then(m => m.OverviewDashboardComponent) },
    { path: 'dashboards/coverage', loadComponent: () => import('./components/dashboards/coverage/coverage.component').then(m => m.CoverageComponent) },
    // Institutions, people and clergy rank are views of one dashboard (?entity=, ?group=).
    { path: 'dashboards/composition', loadComponent: () => import('./components/dashboards/composition/composition.component').then(m => m.CompositionDashboardComponent) },
    { path: 'dashboards/comparison', loadComponent: () => import('./components/dashboards/comparison/comparison.component').then(m => m.ComparisonDashboardComponent) },
    { path: 'dashboards/subset-vs-whole', loadComponent: () => import('./components/dashboards/subset-vs-whole/subset-vs-whole.component').then(m => m.SubsetVsWholeDashboardComponent) },
    { path: 'dashboards/spread', loadComponent: () => import('./components/dashboards/spread/spread.component').then(m => m.SpreadDashboardComponent) },
    { path: 'dashboards/circuits', loadComponent: () => import('./components/dashboards/circuits/circuits.component').then(m => m.CircuitsComponent) },
    { path: 'dashboards/data-issues', loadComponent: () => import('./components/dashboards/data-issues/data-issues.component').then(m => m.DataIssuesComponent) },
    { path: 'dashboards/languages', loadComponent: () => import('./components/dashboards/languages/languages.component').then(m => m.LanguagesComponent) },
    { path: 'dashboards/orders', loadComponent: () => import('./components/dashboards/religious-orders/religious-orders.component').then(m => m.ReligiousOrdersComponent) },
    { path: 'dashboards/clergy-flows', loadComponent: () => import('./components/dashboards/clergy-flows/clergy-flows.component').then(m => m.ClergyFlowsComponent) },
    { path: 'dashboards/rails-rivers', loadComponent: () => import('./components/dashboards/rails-rivers/rails-rivers.component').then(m => m.RailsRiversComponent) },
    { path: 'dashboards/diocese-tracker', loadComponent: () => import('./components/dashboards/diocese-tracker/diocese-tracker.component').then(m => m.DioceseTrackerDashboardComponent) },
    { path: 'dashboards/networks', loadComponent: () => import('./components/networks/networks/networks.component').then(m => m.NetworksComponent) },
    { path: 'dashboards/explore', loadComponent: () => import('./components/dashboards/explore/explore.component').then(m => m.ExploreComponent) },
    // Old addresses of the dashboards merged above keep working.
    { path: 'dashboards/people-composition', redirectTo: redirectWith('/dashboards/composition', { entity: 'people' }) },
    { path: 'dashboards/clergy-hierarchy', redirectTo: redirectWith('/dashboards/composition', { entity: 'people', group: 'rank' }) },
    { path: 'dashboards/people-comparison', redirectTo: redirectWith('/dashboards/comparison', { entity: 'people' }) },
    { path: 'dashboards/people-subset-vs-whole', redirectTo: redirectWith('/dashboards/subset-vs-whole', { entity: 'people' }) },
    { path: 'dashboards/network-institutions', redirectTo: redirectWith('/dashboards/networks', {}) },
    { path: 'dashboards/network-people', redirectTo: redirectWith('/dashboards/networks', { view: 'people' }) },
    { path: 'dashboards/network-service', redirectTo: redirectWith('/dashboards/networks', { view: 'service' }) },
    { path: 'dashboards/explore-institutions', redirectTo: redirectWith('/dashboards/explore', {}) },
    { path: 'dashboards/explore-people', redirectTo: redirectWith('/dashboards/explore', { entity: 'people' }) },
    { path: 'export', loadComponent: () => import('./components/export/export.component').then(m => m.ExportComponent) },
    // Static content pages: drop .md or .html files into client/public/page-content/
    // and they are served at /pages/<file path without extension>
    {
        path: 'pages',
        children: [{
            path: '**',
            loadComponent: () => import('./components/pages/page.component').then(m => m.PageComponent)
        }]
    },
    { path: '404', component: NotFoundComponent },
    { path: '**', redirectTo: '/404' }
];
