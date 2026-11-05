import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../config';

export interface Candidato {
  id: number; cpf: string; name: string; birth_date: string; genre: string;
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
    return this.http.get<any>(`${this.apiUrl}/buscar-nome`, {
      params: new HttpParams().set('termo', termo).set('parcial', String(parcial)),
    });
  }

  buscarCpf(termo: string): Observable<ResultadoCompleto> {
    return this.http.get<ResultadoCompleto>(`${this.apiUrl}/buscar-cpf`, { params: new HttpParams().set('termo', termo) });
  }

  buscarPorId(id: number): Observable<ResultadoCompleto> {
    return this.http.get<ResultadoCompleto>(`${this.apiUrl}/buscar-id`, { params: new HttpParams().set('id', id.toString()) });
  }

  buscarEndereco(termo: string): Observable<{ total: number; enderecos: any[] }> {
    return this.http.get<any>(`${this.apiUrl}/buscar-endereco`, { params: new HttpParams().set('termo', termo) });
  }
}
