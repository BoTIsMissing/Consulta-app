import { Component } from '@angular/core';
import { BuscaComponent } from './components/busca/busca.component';
import { AuthService } from './services/auth.service';
import { FormsModule } from '@angular/forms';
import { HistoryComponent } from './components/history/history.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BuscaComponent, HistoryComponent, FormsModule],
  templateUrl: './auth-shell.html',
  styleUrl: './auth-shell.scss',
})
export class AppComponent {
  email = '';
  password = '';
  showHistory = false;

  constructor(public auth: AuthService) {}

  async entrar() {
    try {
      await this.auth.login(this.email, this.password);
    } finally {
      this.password = '';
    }
  }
}
