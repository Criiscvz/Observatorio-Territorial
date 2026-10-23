import { FormBuilder, Validators } from '@angular/forms';

export const COMMUNITY_LINKS = ['ESTUDIANTE', 'DOCENTE', 'INVESTIGADOR', 'PERSONAL_ADMINISTRATIVO', 'PUBLICO_GENERAL'] as const;
export interface CommunityProfileData {
  vinculo?: string | null;
  institucion_tipo?: string | null;
  institucion?: string | null;
  interes_departamento_id?: string | null;
}

export function createCommunityProfileForm(fb: FormBuilder) {
  return fb.group({
    vinculo: [''],
    institucion_tipo: [''],
    institucion: ['', Validators.maxLength(255)],
    interes_departamento_id: [''],
  }, { validators: group => group.get('institucion_tipo')?.value === 'OTRA' && !String(group.get('institucion')?.value ?? '').trim() ? { institutionRequired: true } : null });
}

export function communityProfilePayload(value: Record<string, string | null>): CommunityProfileData {
  return {
    vinculo: value['vinculo'] || null,
    institucion_tipo: value['institucion_tipo'] || null,
    institucion: value['institucion_tipo'] === 'OTRA' ? value['institucion']?.trim() || null : null,
    interes_departamento_id: value['interes_departamento_id'] || null,
  };
}
