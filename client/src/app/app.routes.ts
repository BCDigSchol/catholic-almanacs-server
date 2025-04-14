import { Routes } from '@angular/router';

import { HomeComponent } from './components/home/home.component';
import { NotFoundComponent } from './components/common/not-found/not-found.component';
import { AboutComponent } from './components/common/about/about.component'; // Import the AboutComponent

export const routes: Routes = [
    { path: 'home', component: HomeComponent },
    { path:'', redirectTo: '/home', pathMatch: 'full' },
    { path: 'about', component: AboutComponent },
    { path: '404', component: NotFoundComponent },
    { path: '**', redirectTo: '/404' }
];
