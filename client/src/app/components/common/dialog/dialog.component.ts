import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogActions, MatDialogContent, MatDialogTitle, MatDialogClose, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-dialog',
  imports: [CommonModule, MatButtonModule, MatDialogActions, MatDialogContent, MatDialogTitle, MatDialogClose],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.scss',
  template:  `
  <h1 mat-dialog-title>{{ data.diocese + ' ' + data.year }}</h1>
    <div mat-dialog-content>
    <p>{{ data.dioceseInfo }}</p>
  </div>
  <div mat-dialog-actions>
    <button mat-button mat-dialog-close>Close</button>
  </div>
  `
})
export class DialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}
}
