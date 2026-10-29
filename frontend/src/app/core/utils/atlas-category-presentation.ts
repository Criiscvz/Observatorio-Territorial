/** Available Material icons, aligned with config/atlas.php on the backend. */
export const ATLAS_CATEGORY_ICONS = [
  { value: 'folder_open', label: 'Carpeta' },
  { value: 'map', label: 'Territorio y mapas' },
  { value: 'groups', label: 'Comunidad' },
  { value: 'work', label: 'Trabajo' },
  { value: 'how_to_vote', label: 'Democracia' },
  { value: 'flight_takeoff', label: 'Turismo' },
  { value: 'school', label: 'Educación' },
  { value: 'health_and_safety', label: 'Salud y bienestar' },
  { value: 'agriculture', label: 'Agricultura' },
  { value: 'engineering', label: 'Ingeniería' },
  { value: 'account_balance', label: 'Finanzas públicas' },
  { value: 'eco', label: 'Ambiente' },
  { value: 'local_hospital', label: 'Servicios de salud' },
  { value: 'science', label: 'Ciencia y tecnología' },
  { value: 'sports', label: 'Deporte' },
  { value: 'construction', label: 'Infraestructura' },
  { value: 'storefront', label: 'Comercio' },
  { value: 'directions_car', label: 'Transporte' },
  { value: 'public', label: 'Geografía' },
  { value: 'security', label: 'Seguridad' },
  { value: 'gavel', label: 'Justicia' },
  { value: 'family_restroom', label: 'Familia' },
  { value: 'trending_up', label: 'Economía' },
  { value: 'theater_comedy', label: 'Cultura' },
  { value: 'home', label: 'Hábitat y vivienda' },
  { value: 'volunteer_activism', label: 'Apoyo social' },
] as const;

/** Shared Atlas identity for administration, the public directory and navigation. */
export function atlasCategoryPresentation(
  name: string,
  icon?: string | null,
): { icon: string; color: string } {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const themes = [
    {
      match: /ambiente|ecolog|naturaleza|biodiversidad/,
      icon: 'eco',
      color: 'var(--chart-color-3)',
    },
    { match: /ciencia|tecnologia|investigacion/, icon: 'science', color: 'var(--chart-color-7)' },
    {
      match: /finanza|gobernanza|gobierno/,
      icon: 'account_balance',
      color: 'var(--chart-color-6)',
    },
    { match: /economia|economico/, icon: 'trending_up', color: 'var(--chart-color-4)' },
    { match: /educacion|academico/, icon: 'school', color: 'var(--chart-color-10)' },
    { match: /salud|bienestar/, icon: 'health_and_safety', color: 'var(--chart-color-2)' },
    { match: /cultura|patrimonio/, icon: 'theater_comedy', color: 'var(--chart-color-9)' },
    { match: /trabajo|laboral|empleo/, icon: 'work', color: 'var(--chart-color-4)' },
    { match: /territorio|geografia|atlas/, icon: 'map', color: 'var(--chart-color-1)' },
    { match: /social|poblacion/, icon: 'groups', color: 'var(--chart-color-3)' },
  ];
  const theme = themes.find((theme) => theme.match.test(normalized)) ?? {
    icon: 'folder_open',
    color: 'var(--chart-color-1)',
  };
  return {
    icon: ATLAS_CATEGORY_ICONS.some((item) => item.value === icon) ? icon! : theme.icon,
    color: theme.color,
  };
}
