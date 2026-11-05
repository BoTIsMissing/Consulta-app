import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../config';

export interface Candidato {
  id: string | number; cpf: string; name: string; birth_date: string; genre: string;
}

export interface ResultadoCompleto {
  encontrado: boolean;
  dados: { people: any[]; profile: any[]; address: any[]; email: any[]; fone: any[]; connected: any[]; credit: any[]; status: any[]; } | null;
}

@Injectable({ providedIn: 'root' })
export class ConsultaService {
  private apiUrl = apiUrl;
  constructor(private http: HttpClient) {}

  buscarNome(termo: string, parcial = false): Observable<{ total: number; candidatos: Candidato[] }> {
    return this.http.post<any>(`${this.apiUrl}/buscar-nome`, { termo, parcial });
  }

  buscarCpf(termo: string): Observable<ResultadoCompleto> {
    return this.http.post<ResultadoCompleto>(`${this.apiUrl}/buscar-cpf`, { termo });
  }

  buscarPorId(id: string | number): Observable<ResultadoCompleto> {
    return this.http.post<ResultadoCompleto>(`${this.apiUrl}/buscar-id`, { id: id.toString() });
  }

  buscarEndereco(termo: string): Observable<{ total: number; enderecos: any[] }> {
    return this.http.post<any>(`${this.apiUrl}/buscar-endereco`, { termo });
  }
}
