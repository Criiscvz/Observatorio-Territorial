import { Injectable } from '@angular/core';

export interface RolePermissionConfig {
  create: boolean;
  edit: boolean;
  editScope: 'all' | 'own';
  delete: boolean;
  deleteScope: 'all' | 'own';
}

export interface SystemPermissions {
  [role: string]: RolePermissionConfig;
}

export interface UserSpecificPermissions {
  [userId: number]: RolePermissionConfig;
}

const ROLE_STORAGE_KEY = 'observatorio_role_permissions';
const USER_STORAGE_KEY = 'observatorio_user_permissions';

const DEFAULT_ROLE_PERMISSIONS: SystemPermissions = {
  ADMIN: {
    create: true,
    edit: true,
    editScope: 'all',
    delete: true,
    deleteScope: 'all',
  },
  EDITOR: {
    create: true,
    edit: true,
    editScope: 'own',
    delete: true,
    deleteScope: 'own',
  },
  USER: {
    create: false,
    edit: false,
    editScope: 'own',
    delete: false,
    deleteScope: 'own',
  },
  SUBSCRIBER: {
    create: false,
    edit: false,
    editScope: 'own',
    delete: false,
    deleteScope: 'own',
  },
};

@Injectable({
  providedIn: 'root',
})
export class PermisosService {
  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized(): void {
    if (!localStorage.getItem(ROLE_STORAGE_KEY)) {
      localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
    }
    if (!localStorage.getItem(USER_STORAGE_KEY)) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({}));
    }
  }

  getRolePermissions(): SystemPermissions {
    this.ensureInitialized();
    const data = localStorage.getItem(ROLE_STORAGE_KEY);
    return data ? JSON.parse(data) : DEFAULT_ROLE_PERMISSIONS;
  }

  saveRolePermissions(permissions: SystemPermissions): void {
    localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(permissions));
  }

  getUserPermissions(userId: number, role: string): RolePermissionConfig {
    this.ensureInitialized();
    const userPermissionsData = localStorage.getItem(USER_STORAGE_KEY);
    const userPermissions: UserSpecificPermissions = userPermissionsData ? JSON.parse(userPermissionsData) : {};
    
    if (userPermissions[userId]) {
      return userPermissions[userId];
    }

    // Fallback to role defaults
    const rolePermissions = this.getRolePermissions();
    return rolePermissions[role] || DEFAULT_ROLE_PERMISSIONS[role];
  }

  saveUserPermissions(userId: number, config: RolePermissionConfig): void {
    this.ensureInitialized();
    const userPermissionsData = localStorage.getItem(USER_STORAGE_KEY);
    const userPermissions: UserSpecificPermissions = userPermissionsData ? JSON.parse(userPermissionsData) : {};
    
    userPermissions[userId] = config;
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userPermissions));
  }

  hasUserPermission(userId: number, role: string, action: 'create' | 'edit' | 'delete', isOwner = false): boolean {
    if (role === 'ADMIN') {
      return true;
    }

    const config = this.getUserPermissions(userId, role);

    if (!config) {
      return false;
    }

    if (action === 'create') {
      return config.create;
    }

    if (action === 'edit') {
      return config.edit && (config.editScope === 'all' || isOwner);
    }

    if (action === 'delete') {
      return config.delete && (config.deleteScope === 'all' || isOwner);
    }

    return false;
  }
}
