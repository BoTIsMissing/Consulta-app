import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ResultadoBusca {
  total: number;
  dados: any[];
}

@Injectable({ providedIn: 'root' })
export class ConsultaService {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  buscar(termo: string, banco: string): Observable<ResultadoBusca> {
    const params = new HttpParams()
      .set('termo', termo)
      .set('banco', banco);
    return this.http.get<ResultadoBusca>(`${this.apiUrl}/buscar`, { params });
  }

  getBancos(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/bancos`);
  }
}
