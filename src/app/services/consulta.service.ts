import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../config';

export interface Candidato {
  id: string | number; cpf: string; name: string; birth_date: string; genre: string;
}

export interface ResultadoCompleto {
  encontrado: boolean;
  dados: { people: any[]; profile: any[]; address: any[]; email: any[]; fone: any[]; connected: any[]; credit: any[]; status: any[]; pep: RegistroPep[]; } | null;
}

export interface RegistroPep {
  cnpj: string | null;
  cnpj_relacionamento: string | null;
  dt_inicio: string | null;
  dt_carencia: string | null;
  descricao_profissao: string | null;
}

export interface Veiculo {
  id: string;
  idvehicles: string | null;
  plate: string;
  renavam: string | null;
  chassis: string | null;
  mark: string | null;
  model: string | null;
  year_of_manufacture: string | number | null;
  model_year: string | number | null;
  color: string | null;
  fuel: string | null;
  body_type: string | null;
  nationality_code: string | number | null;
  nationality_description: string | null;
  state: string | null;
  city: string | null;
  origin: string | null;
  dt_insert: string | null;
  dt_edit: string | null;
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

  buscarPlaca(termo: string): Observable<{ total: number; veiculos: Veiculo[] }> {
    return this.http.post<{ total: number; veiculos: Veiculo[] }>(`${this.apiUrl}/buscar-placa`, { termo });
  }

  buscarPorId(id: string | number): Observable<ResultadoCompleto> {
    return this.http.post<ResultadoCompleto>(`${this.apiUrl}/buscar-id`, { id: id.toString() });
  }

  buscarEndereco(termo: string): Observable<{ total: number; enderecos: any[] }> {
    return this.http.post<any>(`${this.apiUrl}/buscar-endereco`, { termo });
  }
}
