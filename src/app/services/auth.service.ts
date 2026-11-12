import { Injectable, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  Auth, User, browserSessionPersistence, initializeAuth,
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import { apiUrl, firebaseConfig } from '../config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<User | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly authorized = signal(false);
  readonly historyAdmin = signal(false);
  readonly historyEnabled = signal(false);
  readonly error = signal('');
  readonly configured = Object.values(firebaseConfig).every(value => Boolean(value.trim()));
  private auth: Auth | null = null;
  private revision = 0;

  constructor() {
    if (!this.configured) {
      this.loading.set(false);
      return;
    }
    try {
      this.auth = initializeAuth(initializeApp(firebaseConfig), {
        persistence: browserSessionPersistence,
      });
      onAuthStateChanged(this.auth, user => { void this.checkSession(user); }, () => {
        this.authorized.set(false);
        this.error.set('Não foi possível verificar sua sessão. Atualize a página.');
        this.loading.set(false);
      });
    } catch {
      this.error.set('Não foi possível iniciar a autenticação. Confira a configuração do Firebase.');
      this.loading.set(false);
    }
  }

  private async checkSession(user: User | null) {
    const revision = ++this.revision;
    this.authorized.set(false);
    this.historyAdmin.set(false);
    this.historyEnabled.set(false);
    this.user.set(user);
    this.loading.set(true);
    this.error.set('');
    try {
      if (user) {
        const token = await user.getIdToken();
        const response = await fetch(`${apiUrl}/auth/session`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.erro || 'Não foi possível verificar seu acesso. Tente novamente.');
        }
        const session = await response.json();
        if (revision === this.revision) {
          this.historyAdmin.set(session.historyAdmin === true);
          this.historyEnabled.set(session.historyEnabled === true);
          this.authorized.set(true);
        }
      }
    } catch (error) {
      if (revision === this.revision) this.error.set(
        error instanceof Error ? error.message : 'Não foi possível verificar seu acesso.',
      );
    } finally {
      if (revision === this.revision) this.loading.set(false);
    }
  }

  async login(email: string, password: string) {
    if (!this.auth || this.busy()) return;
    if (!email.trim() || !password) {
      this.error.set('Preencha o e-mail e a senha.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await signInWithEmailAndPassword(this.auth, email.trim(), password);
      await this.checkSession(result.user);
    } catch (error) {
      const code = (error as { code?: string }).code;
      const messages: Record<string, string> = {
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
        'auth/user-not-found': 'E-mail ou senha incorretos.',
        'auth/wrong-password': 'E-mail ou senha incorretos.',
        'auth/invalid-email': 'Digite um e-mail válido.',
        'auth/user-disabled': 'Esta conta foi desativada. Contate o administrador.',
        'auth/too-many-requests': 'Muitas tentativas de login. Aguarde e tente novamente.',
        'auth/network-request-failed': 'Não foi possível conectar. Verifique sua conexão.',
      };
      this.error.set(messages[code || ''] || 'Não foi possível entrar. Contate o administrador.');
    } finally {
      this.busy.set(false);
    }
  }

  async logout() {
    this.revision++;
    this.authorized.set(false);
    this.historyAdmin.set(false);
    this.historyEnabled.set(false);
    this.user.set(null);
    this.loading.set(false);
    if (this.auth) {
      try { await signOut(this.auth); }
      catch { this.error.set('Não foi possível encerrar a sessão. Tente novamente.'); }
    }
  }

  async token(): Promise<string> {
    const user = this.auth?.currentUser;
    if (!user || !this.authorized()) throw new Error('Entre na sua conta para continuar.');
    return user.getIdToken();
  }

  denyAccess(message: string) {
    this.revision++;
    this.authorized.set(false);
    this.historyAdmin.set(false);
    this.historyEnabled.set(false);
    this.loading.set(false);
    this.error.set(message);
  }
}
