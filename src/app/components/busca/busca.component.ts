import { Component, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ConsultaService, Candidato, DadosEmpresa } from '../../services/consulta.service';
import { Subject, takeUntil } from 'rxjs';
import { PhoneInputComponent } from './phone-input.component';

@Component({
  selector: 'app-busca',
  standalone: true,
  imports: [CommonModule, FormsModule, PhoneInputComponent],
  templateUrl: './busca.component.html',
  styleUrls: ['./busca.component.scss'],
})
export class BuscaComponent implements OnDestroy {
  private stopRequests = new Subject<void>();
  termo = '';
  ddd = '';
  tipo = 'Nome';
  notaTexto = '';
  notaSalva = '';
  copiado: string | null = null;

  candidatos: Candidato[] = [];
  enderecos: any[] = [];
  dados: any = null;
  private dadosEmpresa: DadosEmpresa | null = null;
  carregando = false;
  erro = '';
  buscaFeita = false;
  private mapas = new Map<string, SafeResourceUrl>();

  private secoesPessoas = [
    { key: 'people',    label: 'Identificação' },
    { key: 'profile',   label: 'Perfil' },
    { key: 'address',   label: 'Endereços' },
    { key: 'email',     label: 'Emails' },
    { key: 'fone',      label: 'Telefones' },
    { key: 'connected', label: 'Família/Vínculos' },
    { key: 'pep',       label: 'Registros PEP / CNPJ' },
    { key: 'credit',    label: 'Crédito' },
    { key: 'status',    label: 'Status' },
  ];

  private secoesVeiculos = [{ key: 'vehicles', label: 'Veículos' }];

  private secoesEmpresas = [
    { key: 'company', label: 'Empresa' },
    { key: 'company_profile', label: 'Perfil da empresa' },
    { key: 'company_address', label: 'Endereços da empresa' },
    { key: 'company_email', label: 'E-mails da empresa' },
    { key: 'company_fone', label: 'Telefones da empresa' },
    { key: 'company_partners', label: 'Sócios' },
    { key: 'company_representatives', label: 'Representantes legais' },
    { key: 'company_status', label: 'Situação da empresa' },
    { key: 'company_simples', label: 'Simples / MEI' },
    { key: 'cnes', label: 'CNES' },
  ];

  get secoes() {
    if (this.tipo === 'CNPJ') return [
      ...this.secoesEmpresas,
      ...(this.dados?.people?.length ? this.secoesPessoas : []),
    ];
    return this.tipo === 'Placa' ? this.secoesVeiculos : this.secoesPessoas;
  }

  constructor(
    private consultaService: ConsultaService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
  ) {}

  get buscaPorNome(): boolean {
    return this.tipo === 'Nome' || this.tipo === 'Nome parcial';
  }

  atualizarTermo(valor: string) {
    this.termo = this.buscaPorNome || this.tipo === 'Placa' ? valor.toUpperCase() : valor;
  }

  get podeBuscar(): boolean {
    if (this.tipo === 'Telefone') return /^[1-9]\d$/.test(this.ddd.replace(/[()\s]/g, ''))
      && /^\d{8,9}$/.test(this.termo.replace(/[\s-]/g, ''));
    return this.termo.trim().length >= 2;
  }

  buscar() {
    if (!this.podeBuscar) return;
    this.stopRequests.next();
    this.atualizarTermo(this.termo.trim());
    this.carregando = true;
    this.erro = '';
    this.buscaFeita = false;
    this.dados = null;
    this.dadosEmpresa = null;
    this.mapas.clear();
    this.candidatos = [];
    this.enderecos = [];
    this.notaSalva = '';
    this.notaTexto = '';

    if (this.tipo === 'Placa') {
      this.consultaService.buscarPlaca(this.termo).pipe(takeUntil(this.stopRequests)).subscribe({
        next: (res) => {
          this.carregando = false;
          this.buscaFeita = true;
          if (res.total === 0) this.erro = 'Nenhum veículo encontrado para esta placa.';
          else this.dados = { vehicles: res.veiculos };
          this.cdr.detectChanges();
        },
        error: (err) => { this.handleErro(err); },
      });
    } else if (this.tipo === 'CNPJ') {
      this.consultaService.buscarCnpj(this.termo).pipe(takeUntil(this.stopRequests)).subscribe({
        next: (res) => {
          this.carregando = false;
          this.buscaFeita = true;
          this.dadosEmpresa = res.empresa || null;
          this.dados = this.dadosEmpresa;
          if (res.total === 0 && !this.dadosEmpresa) {
            this.erro = 'Nenhuma empresa, CNES ou pessoa encontrada para este CNPJ.';
          } else if (res.total === 1) {
            this.selecionarPessoa(res.candidatos[0].id);
          } else {
            this.candidatos = res.candidatos;
          }
          this.cdr.detectChanges();
        },
        error: (err) => { this.handleErro(err); },
      });
    } else if (this.tipo === 'CPF') {
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
      const consulta = this.tipo === 'Telefone'
        ? this.consultaService.buscarTelefone(this.ddd, this.termo)
        : this.consultaService.buscarNome(this.termo, this.tipo === 'Nome parcial');
      consulta.pipe(takeUntil(this.stopRequests)).subscribe({
        next: (res) => {
          this.carregando = false;
          this.buscaFeita = true;
          if (res.total === 0) {
            this.erro = this.tipo === 'Telefone' ? 'Nenhuma pessoa encontrada para este DDD e telefone.' : 'Nenhum registro encontrado.';
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
    this.dados = this.tipo === 'CNPJ' ? this.dadosEmpresa : null;
    this.mapas.clear();
    this.notaSalva = '';
    this.notaTexto = '';
    this.cdr.detectChanges();

    this.consultaService.buscarPorId(id).pipe(takeUntil(this.stopRequests)).subscribe({
      next: (res) => {
        this.carregando = false;
        this.dados = res.encontrado ? { ...this.dadosEmpresa, ...res.dados } : this.dadosEmpresa;
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
    this.ddd = '';
    this.dados = null;
    this.dadosEmpresa = null;
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
    if (col === 'cpf' || col === 'cpf6' || col === 'cpf_representante') return this.formatarCpf(String(valor));
    if (col === 'doc_partners' && /^\d{11}$/.test(String(valor))) return this.formatarCpf(String(valor));
    if (col === 'cnpj' || col === 'cnpj_relacionamento' || col === 'doc_partners') {
      return String(valor).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    if (col.startsWith('dt_')) return this.formatarData(String(valor));
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
      !['id', 'id_relative', ...(secao === 'vehicles' ? ['idvehicles'] : [])].includes(k.toLowerCase()) && this.temValor(obj[k]),
    );
  }

  rotuloCampo(col: string, secao: string): string {
    if (col === 'relative') return 'Parentesco';
    if (secao === 'company' || secao === 'cnes' || secao.startsWith('company_')) {
      const rotulos: Record<string, string> = {
        cnpj: 'CNPJ', cnpj8: 'Raiz do CNPJ', name1: 'Nome 1', name2: 'Nome 2',
        dt_information: 'Data da informação', dt_insert: 'Data de inclusão', dt_edit: 'Data de atualização',
        origin: 'Origem', cnes: 'CNES', ty_company: 'Tipo de empresa', birth_date: 'Data de abertura',
        legal_nature: 'Natureza jurídica (código)', matriz: 'Indicador de matriz', share_capital: 'Capital social',
        size: 'Porte', tp_cnae: 'Tipo de CNAE', cnae: 'CNAE', cnas2: 'CNAEs adicionais',
        employees_range: 'Faixa de funcionários (código)', billing_range: 'Faixa de faturamento',
        endereco: 'Endereço', tipo_logradouro: 'Tipo de logradouro', logradouro: 'Logradouro',
        numero: 'Número', complemento: 'Complemento', bairro: 'Bairro', cidade: 'Cidade',
        uf: 'UF', cep: 'CEP', pais: 'País', cidade_exterior: 'Cidade no exterior',
        email: 'E-mail', telefone: 'Telefone', ddd: 'DDD', fone: 'Número', type_fone: 'Tipo de telefone (código)',
        type_partners: 'Tipo de vínculo', doc_partners: 'Documento do sócio', name: 'Nome', dt_entrada: 'Data de entrada',
        qualificacao: 'Qualificação', participacao: 'Participação', cpf_representante: 'CPF do representante',
        nome_representante: 'Nome do representante', qualificacao_representante: 'Qualificação do representante',
        cidade_pais: 'Cidade / país', qualificador_cod: 'Qualificação (código)', situacao: 'Situação',
        situacao_motivo: 'Motivo da situação', dt_situacao: 'Data da situação', dt_inicio_atividade: 'Início da atividade',
        situacao_especial: 'Situação especial', dt_situacao_especial: 'Data da situação especial',
        simples: 'Simples', dt_simples: 'Data do Simples', dt_simples_exclusao: 'Exclusão do Simples',
        mei: 'MEI', dt_mei: 'Data do MEI', dt_mei_exclusao: 'Exclusão do MEI',
      };
      return rotulos[col] || col;
    }
    if (secao === 'pep') {
      const rotulos: Record<string, string> = {
        cnpj: 'CNPJ', cnpj_relacionamento: 'CNPJ relacionamento',
        dt_inicio: 'Data de início', dt_carencia: 'Data de carência',
        descricao_profissao: 'Descrição da profissão',
      };
      return rotulos[col] || col;
    }
    if (secao !== 'vehicles') return col;
    const rotulos: Record<string, string> = {
      plate: 'Placa', renavam: 'Renavam', chassis: 'Chassi', mark: 'Marca', model: 'Modelo',
      year_of_manufacture: 'Ano de fabricação', model_year: 'Ano do modelo', color: 'Cor',
      fuel: 'Combustível', body_type: 'Carroceria', nationality_code: 'Código de nacionalidade',
      nationality_description: 'Nacionalidade', state: 'UF', city: 'Cidade', origin: 'Origem',
      dt_insert: 'Data de inclusão', dt_edit: 'Data de atualização',
    };
    return rotulos[col] || col;
  }

  temDados(key: string): boolean {
    return this.dados && this.dados[key] && this.dados[key].length > 0;
  }

  ngOnDestroy() {
    this.stopRequests.next();
    this.stopRequests.complete();
  }
}
