import { Component } from '@angular/core';
import { BuscaComponent } from './components/busca/busca.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BuscaComponent],
  template: '<app-busca></app-busca>',
})
export class AppComponent {}
