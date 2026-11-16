import { Component, Output, EventEmitter } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-welcome', standalone: true, imports: [IconComponent],
  templateUrl: './welcome.component.html', styleUrl: './welcome.component.scss',
})
export class WelcomeComponent {
  @Output() choose = new EventEmitter<string>();
}
