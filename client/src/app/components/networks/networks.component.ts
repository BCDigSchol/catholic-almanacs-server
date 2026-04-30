import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';

@Component({
  selector: 'app-networks',
  imports: [MatIconModule, MatButtonModule, MatCardModule, MatGridListModule],
  templateUrl: './networks.component.html',
  styleUrl: './networks.component.scss'
})
export class NetworksComponent {

    constructor(private router: Router) { }

    navigate(path: string) {
        this.router.navigate([path]);
    }

}
