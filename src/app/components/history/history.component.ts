import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { apiUrl } from '../../config';

interface HistoryEntry {
  id: string; uid: string; email: string; type: string; term: string; at: string;
}
interface HistoryPage { items: HistoryEntry[]; nextCursor: string | null; }

@Component({
  selector: 'app-history', standalone: true, imports: [CommonModule],
  templateUrl: './history.component.html', styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit, OnDestroy {
  readonly entries = signal<HistoryEntry[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly page = signal(1);
  readonly nextCursor = signal<string | null>(null);
  private currentCursor: string | null = null;
  private previousCursors: (string | null)[] = [];
  private stopRequests = new Subject<void>();
  constructor(private http: HttpClient) {}

  ngOnInit() { this.refresh(); }
  refresh() { this.load(null, [], 1); }
  next() {
    const cursor = this.nextCursor();
    if (cursor) this.load(cursor, [...this.previousCursors, this.currentCursor], this.page() + 1);
  }
  previous() {
    const previous = [...this.previousCursors];
    if (!previous.length) return;
    const cursor = previous.pop()!;
    this.load(cursor, previous, this.page() - 1);
  }
  private load(cursor: string | null, previous: (string | null)[], page: number) {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.http.post<HistoryPage>(`${apiUrl}/admin/history`, { cursor })
      .pipe(takeUntil(this.stopRequests)).subscribe({
        next: response => {
          this.entries.set(response.items);
          this.nextCursor.set(response.nextCursor);
          this.currentCursor = cursor;
          this.previousCursors = previous;
          this.page.set(page);
          this.loading.set(false);
        },
        error: error => {
          this.error.set(error.error?.erro || 'Não foi possível carregar o histórico.');
          this.loading.set(false);
        },
      });
  }
  label(type: string) {
    const labels: Record<string, string> = {
      nome: 'Nome completo', nome_parcial: 'Nome parcial', cpf: 'CPF', cnpj: 'CNPJ',
      placa: 'Placa', telefone: 'Telefone', endereco: 'Endereço', id: 'Abertura de pessoa por ID',
    };
    return labels[type] || type;
  }
  ngOnDestroy() { this.stopRequests.next(); this.stopRequests.complete(); }
}
