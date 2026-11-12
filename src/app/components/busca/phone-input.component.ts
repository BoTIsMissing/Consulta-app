import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-phone-input', standalone: true, imports: [FormsModule],
  template: `
    <label><span>DDD</span>
      <input [ngModel]="ddd" (ngModelChange)="dddChange.emit($event)" inputmode="numeric"
        type="tel" maxlength="8" placeholder="11" autocomplete="off" aria-label="DDD"
        [disabled]="disabled" (keyup.enter)="search.emit()" />
    </label>
    <label><span>Telefone sem DDD</span>
      <input [ngModel]="fone" (ngModelChange)="foneChange.emit($event)" inputmode="numeric"
        type="tel" maxlength="20" placeholder="99999-9999" autocomplete="off" aria-label="Telefone sem DDD"
        enterkeyhint="search" [disabled]="disabled" (keyup.enter)="search.emit()" />
    </label>
    @if (ddd || fone) {
      <button type="button" aria-label="Limpar telefone" [disabled]="disabled" (click)="clear.emit()">✕</button>
    }
  `,
  styleUrl: './phone-input.component.scss',
})
export class PhoneInputComponent {
  @Input() ddd = '';
  @Input() fone = '';
  @Input() disabled = false;
  @Output() dddChange = new EventEmitter<string>();
  @Output() foneChange = new EventEmitter<string>();
  @Output() search = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();
}
