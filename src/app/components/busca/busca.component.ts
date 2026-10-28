import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConsultaService } from '../../services/consulta.service';

@Component({
  selector: 'app-busca',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './busca.component.html',
  styleUrls: ['./busca.component.css'],
})
export class BuscaComponent implements OnInit {
  termo = '';
  bancoSelecionado = 'BR_SAUDE';
  bancos: string[] = [];

  resultados: any[] = [];
  colunas: string[] = [];
  total = 0;

  carregando = false;
  erro = '';
  buscaFeita = false;

  constructor(private consultaService: ConsultaService) {}

  ngOnInit() {
    this.consultaService.getBancos().subscribe({
      next: (bancos) => (this.bancos = bancos),
      error: () => (this.bancos = ['BR_SAUDE']),
    });
  }

  buscar() {
    if (!this.termo.trim() || this.termo.trim().length < 2) return;

    this.carregando = true;
    this.erro = '';
    this.buscaFeita = false;
    this.resultados = [];

    this.consultaService.buscar(this.termo, this.bancoSelecionado).subscribe({
      next: (res) => {
        this.resultados = res.dados;
        this.total = res.total;
        this.colunas = res.dados.length > 0 ? Object.keys(res.dados[0]) : [];
        this.carregando = false;
        this.buscaFeita = true;
      },
      error: (err) => {
        this.erro = err.error?.erro || 'Erro ao conectar com o servidor.';
        this.carregando = false;
        this.buscaFeita = true;
      },
    });
  }

  limpar() {
    this.termo = '';
    this.resultados = [];
    this.colunas = [];
    this.buscaFeita = false;
    this.erro = '';
    this.total = 0;
  }

  get isCpf(): boolean {
    return /^\d+$/.test(this.termo.trim());
  }
}
