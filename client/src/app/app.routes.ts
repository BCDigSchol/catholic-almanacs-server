import { Routes } from '@angular/router';

import { HomeComponent } from './components/home/home.component';
import { NotFoundComponent } from './components/common/not-found/not-found.component';
import { AboutComponent } from './components/common/about/about.component'; 
import { BrowseInstitutionComponent } from './components/insitutions/browse-institution/browse-institution.component';
import { InstitutionDetailsComponent } from './components/insitutions/institution-details/institution-details.component';
import { BrowsePeopleComponent } from './components/people/browse-people/browse-people.component';

export const routes: Routes = [
    { path: 'home', component: HomeComponent },
    { path: '', redirectTo: '/home', pathMatch: 'full' },
    { path: 'about', component: AboutComponent },
    { path: 'institutions', component: BrowseInstitutionComponent },
    { path: 'institutions/:id', component: InstitutionDetailsComponent },
    { path: 'people', component: BrowsePeopleComponent},
    { path: '404', component: NotFoundComponent },
    { path: '**', redirectTo: '/404' }
];
