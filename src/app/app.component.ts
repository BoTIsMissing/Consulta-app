import { Component } from '@angular/core';
import { BuscaComponent } from './components/busca/busca.component';
import { AuthService } from './services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BuscaComponent, FormsModule],
  templateUrl: './auth-shell.html',
  styleUrl: './auth-shell.css',
})
export class AppComponent {
  email = '';
  password = '';

  constructor(public auth: AuthService) {}

  async entrar() {
    try {
      await this.auth.login(this.email, this.password);
    } finally {
      this.password = '';
    }
  }
}
