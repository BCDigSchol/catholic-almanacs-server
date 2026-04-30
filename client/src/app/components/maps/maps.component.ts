import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
@Component({
  selector: 'app-maps',
  imports: [MatIconModule, MatButtonModule, MatCardModule],
  templateUrl: './maps.component.html',
  styleUrl: './maps.component.scss'
})
export class MapsComponent {

    constructor(private router: Router) { }

    navigate(path: string) {
        this.router.navigate([path]);
    }

}
