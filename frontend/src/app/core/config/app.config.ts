import { AppConfig } from './app-config.interface';

/**
 * Configuración estática de la aplicación
 * Centraliza la información que se repite en todo el sitio
 */
export const APP_CONFIG: AppConfig = {
  app: {
    name: 'Dimensiones Territoriales Multidisciplinario',
    shortName: 'DTM',
    description: 'Sistema de Información y Dimensiones Territoriales',
  },
  university: {
    name: 'Universidad Laica Eloy Alfaro de Manabí',
    shortName: 'ULEAM',
    url: 'https://www.uleam.edu.ec',
    address: 'Av. Circunvalación - Vía a San Mateo',
    location: 'Manta - Manabí - Ecuador',
  },
} as const;
