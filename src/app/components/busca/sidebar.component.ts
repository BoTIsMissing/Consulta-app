import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar', standalone: true, imports: [CommonModule],
  templateUrl: './sidebar.component.html', styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  @Input() tipo = 'Nome';
  @Input() dados: any = null;
  @Input() secoes: { key: string; label: string }[] = [];
  @Input() historyMode = false;
  @Output() selected = new EventEmitter<string>();

  temDados(key: string): boolean { return Boolean(this.dados?.[key]?.length); }
}
