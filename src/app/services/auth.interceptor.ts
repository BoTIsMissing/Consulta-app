import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { apiUrl } from '../config';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(`${apiUrl}/`)) return next(req);
  const auth = inject(AuthService);
  return from(auth.token()).pipe(
    switchMap(token => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
    catchError(error => {
      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
        auth.denyAccess(error.error?.erro || 'Sua sessão expirou. Entre novamente.');
      }
      return throwError(() => error);
    }),
  );
};
