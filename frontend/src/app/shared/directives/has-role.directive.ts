import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models';

/**
 * Directiva estructural que muestra/oculta elementos según el rol del usuario.
 * 
 * Uso:
 * ```html
 * <button *hasRole="'ADMIN'">Solo Admin</button>
 * <div *hasRole="['ADMIN', 'USER']">Admin o User</div>
 * ```
 */
@Directive({
  selector: '[hasRole]',
  standalone: true
})
export class HasRoleDirective {
  private readonly authService = inject(AuthService);
  private readonly templateRef = inject(TemplateRef<any>);
  private readonly viewContainer = inject(ViewContainerRef);
  
  private hasView = false;
  private roles: UserRole[] = [];

  constructor() {
    // Efecto reactivo que actualiza la vista cuando cambia el usuario
    effect(() => {
      const user = this.authService.user();
      this.updateView(user?.rol);
    });
  }

  @Input()
  set hasRole(roles: UserRole | UserRole[]) {
    this.roles = Array.isArray(roles) ? roles : [roles];
    const user = this.authService.user();
    this.updateView(user?.rol);
  }

  private updateView(userRole: UserRole | undefined): void {
    const shouldShow = userRole ? this.roles.includes(userRole) : false;

    if (shouldShow && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!shouldShow && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}

/**
 * Directiva que muestra elementos solo para usuarios admin.
 * 
 * Uso:
 * ```html
 * <button *isAdmin>Solo Admin</button>
 * ```
 */
@Directive({
  selector: '[isAdmin]',
  standalone: true
})
export class IsAdminDirective {
  private readonly authService = inject(AuthService);
  private readonly templateRef = inject(TemplateRef<any>);
  private readonly viewContainer = inject(ViewContainerRef);
  
  private hasView = false;

  constructor() {
    effect(() => {
      const isAdmin = this.authService.isAdmin();
      this.updateView(isAdmin);
    });
  }

  private updateView(isAdmin: boolean): void {
    if (isAdmin && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!isAdmin && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}

/**
 * Directiva que muestra elementos solo para usuarios autenticados.
 * 
 * Uso:
 * ```html
 * <div *isAuthenticated>Solo usuarios autenticados</div>
 * ```
 */
@Directive({
  selector: '[isAuthenticated]',
  standalone: true
})
export class IsAuthenticatedDirective {
  private readonly authService = inject(AuthService);
  private readonly templateRef = inject(TemplateRef<any>);
  private readonly viewContainer = inject(ViewContainerRef);
  
  private hasView = false;

  constructor() {
    effect(() => {
      const isAuth = this.authService.isAuthenticated();
      this.updateView(isAuth);
    });
  }

  private updateView(isAuth: boolean): void {
    if (isAuth && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!isAuth && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
