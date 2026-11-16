import { Component, Input, Output, EventEmitter } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';
import { IconComponent } from '../icon/icon.component';

export interface CardField { key: string; label: string; value: string; }

@Component({
  selector: 'app-result-card', standalone: true, imports: [IconComponent],
  template: `<article class="card">
    @for (field of fields; track field.key) {
      <div class="card-linha"><span class="card-label">{{ field.label }}</span>
        <span class="card-valor"><span class="valor-texto">{{ field.value }}</span>
          <button class="btn-copiar no-print" type="button" [attr.aria-label]="'Copiar ' + field.label"
            (click)="copy.emit({value:field.value,key:copyPrefix+':'+field.key})"
            [class.copiado]="copiedKey === copyPrefix+':'+field.key">
            <app-icon [name]="copiedKey === copyPrefix+':'+field.key ? 'check' : 'copy'" [size]="15" />
          </button>
        </span>
      </div>
    }
    @if (unconfirmed) {
      <p class="card-linha busca-hint"><app-icon name="alert" [size]="16" />Documento e nascimento não confirmados para este vínculo. Pessoas com o mesmo nome não são associadas automaticamente.</p>
    }
    @if (mapUrl) {
      <div class="mapa-wrap no-print"><iframe class="mapa-embed" [src]="mapUrl" title="Localização do endereço no Google Maps" loading="lazy" allowfullscreen referrerpolicy="no-referrer"></iframe></div>
    }
  </article>`,
  styleUrl: './result-card.component.scss',
})
export class ResultCardComponent {
  @Input() fields: CardField[] = [];
  @Input() copyPrefix = '';
  @Input() copiedKey: string | null = null;
  @Input() unconfirmed = false;
  @Input() mapUrl: SafeResourceUrl | null = null;
  @Output() copy = new EventEmitter<{ value: string; key: string }>();
}
