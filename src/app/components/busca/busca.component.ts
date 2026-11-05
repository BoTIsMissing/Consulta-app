import { Component, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ConsultaService, Candidato } from '../../services/consulta.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-busca',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './busca.component.html',
  styleUrls: ['./busca.component.scss'],
})
export class BuscaComponent implements OnDestroy {
  private stopRequests = new Subject<void>();
  termo = '';
  tipo = 'Nome';
  notaTexto = '';
  notaSalva = '';
  copiado: string | null = null;

  candidatos: Candidato[] = [];
  enderecos: any[] = [];
  dados: any = null;
  carregando = false;
  erro = '';
  buscaFeita = false;
  private mapas = new Map<string, SafeResourceUrl>();

  secoes = [
    { key: 'people',    label: 'Identificação' },
    { key: 'profile',   label: 'Perfil' },
    { key: 'address',   label: 'Endereços' },
    { key: 'email',     label: 'Emails' },
    { key: 'fone',      label: 'Telefones' },
    { key: 'connected', label: 'Família/Vínculos' },
    { key: 'credit',    label: 'Crédito' },
    { key: 'status',    label: 'Status' },
  ];

  constructor(
    private consultaService: ConsultaService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
  ) {}

  get buscaPorNome(): boolean {
    return this.tipo === 'Nome' || this.tipo === 'Nome parcial';
  }

  atualizarTermo(valor: string) {
    this.termo = this.buscaPorNome ? valor.toUpperCase() : valor;
  }

  buscar() {
    if (!this.termo.trim() || this.termo.trim().length < 2) return;
    this.stopRequests.next();
    this.atualizarTermo(this.termo.trim());
    this.carregando = true;
    this.erro = '';
    this.buscaFeita = false;
    this.dados = null;
    this.mapas.clear();
    this.candidatos = [];
    this.enderecos = [];
    this.notaSalva = '';
    this.notaTexto = '';

    if (this.tipo === 'CPF') {
      this.consultaService.buscarCpf(this.termo).pipe(takeUntil(this.stopRequests)).subscribe({
        next: (res) => {
          this.carregando = false;
          this.buscaFeita = true;
          res.encontrado ? (this.dados = res.dados) : (this.erro = 'Nenhum registro encontrado.');
          this.cdr.detectChanges();
        },
        error: (err) => { this.handleErro(err); },
      });
    } else if (this.tipo === 'Endereço') {
      this.consultaService.buscarEndereco(this.termo).pipe(takeUntil(this.stopRequests)).subscribe({
        next: (res) => {
          this.carregando = false;
          this.buscaFeita = true;
          res.total === 0 ? (this.erro = 'Nenhum endereço encontrado.') : (this.enderecos = res.enderecos);
          this.cdr.detectChanges();
        },
        error: (err) => { this.handleErro(err); },
      });
    } else {
      this.consultaService.buscarNome(this.termo, this.tipo === 'Nome parcial').pipe(takeUntil(this.stopRequests)).subscribe({
        next: (res) => {
          this.carregando = false;
          this.buscaFeita = true;
          if (res.total === 0) {
            this.erro = 'Nenhum registro encontrado.';
          } else if (res.total === 1) {
            this.selecionarPessoa(res.candidatos[0].id);
          } else {
            this.candidatos = res.candidatos;
          }
          this.cdr.detectChanges();
        },
        error: (err) => { this.handleErro(err); },
      });
    }
  }

  selecionarPessoa(id: string | number) {
    this.stopRequests.next();
    this.carregando = true;
    this.candidatos = [];
    this.dados = null;
    this.mapas.clear();
    this.notaSalva = '';
    this.notaTexto = '';
    this.cdr.detectChanges();

    this.consultaService.buscarPorId(id).pipe(takeUntil(this.stopRequests)).subscribe({
      next: (res) => {
        this.carregando = false;
        this.dados = res.encontrado ? res.dados : null;
        if (!res.encontrado) this.erro = 'Erro ao carregar dados.';
        this.cdr.detectChanges();
      },
      error: (err) => { this.handleErro(err); },
    });
  }

  handleErro(err: any) {
    this.erro = err.error?.erro || 'Erro ao conectar com o servidor.';
    this.carregando = false;
    this.buscaFeita = true;
    this.cdr.detectChanges();
  }

  limpar() {
    this.stopRequests.next();
    this.carregando = false;
    this.termo = '';
    this.dados = null;
    this.mapas.clear();
    this.candidatos = [];
    this.enderecos = [];
    this.buscaFeita = false;
    this.erro = '';
    this.notaSalva = '';
    this.notaTexto = '';
    this.cdr.detectChanges();
  }

  copiar(valor: string, chave: string) {
    navigator.clipboard.writeText(valor ?? '').then(() => {
      this.copiado = chave;
      setTimeout(() => { this.copiado = null; this.cdr.detectChanges(); }, 1500);
      this.cdr.detectChanges();
    });
  }

  salvarNota() {
    this.notaSalva = this.notaTexto;
  }

  mapaUrl(lat: unknown, lng: unknown): SafeResourceUrl | null {
    const latitude = this.coordenada(lat, 90);
    const longitude = this.coordenada(lng, 180);
    if (latitude === null || longitude === null) return null;

    const coordenadas = `${latitude},${longitude}`;
    let url = this.mapas.get(coordenadas);
    if (!url) {
      // Somente o domínio fixo do Google e coordenadas numéricas são autorizados.
      url = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.google.com/maps?q=${encodeURIComponent(coordenadas)}&z=16&hl=pt-BR&output=embed`,
      );
      this.mapas.set(coordenadas, url);
    }
    return url;
  }

  private coordenada(valor: unknown, limite: number): number | null {
    if (typeof valor !== 'string' && typeof valor !== 'number') return null;
    const texto = String(valor).trim().replace(',', '.');
    if (!texto) return null;
    const numero = Number(texto);
    return Number.isFinite(numero) && Math.abs(numero) <= limite ? numero : null;
  }

  exportarPdf() {
    window.print();
  }

  formatarCpf(cpf: string): string {
    if (!cpf || cpf.length !== 11) return cpf;
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  formatarData(data: string): string {
    if (!data) return data;
    const partes = data.match(/^(\d{4})-?(\d{2})-?(\d{2})(?:T.*)?$/);
    return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : data;
  }

  formatarValor(col: string, valor: any): string {
    if (valor === null || valor === undefined || valor === '' || valor === 'None') return '';
    if (col === 'cpf' || col === 'cpf6') return this.formatarCpf(String(valor));
    if (col.includes('date') || col.includes('nascimento') || col === 'birth_date')
      return this.formatarData(String(valor));
    return String(valor);
  }

  temValor(valor: any): boolean {
    return valor !== null && valor !== undefined && valor !== '' && valor !== 'None' && valor !== 'NULL';
  }

  keys(obj: any, secao = ''): string[] {
    if (!obj) return [];
    if (secao === 'connected') return ['name', 'name_relative', 'relative', 'cpf', 'birth_date'];
    return Object.keys(obj).filter(k =>
      !['id', 'id_relative'].includes(k.toLowerCase()) && this.temValor(obj[k]),
    );
  }

  temDados(key: string): boolean {
    return this.dados && this.dados[key] && this.dados[key].length > 0;
  }

  ngOnDestroy() {
    this.stopRequests.next();
    this.stopRequests.complete();
  }
}
