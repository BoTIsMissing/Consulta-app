import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-sidebar', standalone: true, imports: [CommonModule, IconComponent],
  templateUrl: './sidebar.component.html', styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  @Input() tipo = 'Nome';
  @Input() dados: any = null;
  @Input() secoes: { key: string; label: string }[] = [];
  @Input() historyMode = false;
  @Output() selected = new EventEmitter<string>();

  temDados(key: string): boolean { return Boolean(this.dados?.[key]?.length); }
  icon(tipo: string): string {
    return ({ Nome: 'person', 'Nome parcial': 'search', CPF: 'id', CNPJ: 'building',
      Telefone: 'phone', Endereço: 'map', Placa: 'car' } as Record<string, string>)[tipo] || 'search';
  }
}
