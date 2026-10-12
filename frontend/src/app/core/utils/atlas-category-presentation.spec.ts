import { ATLAS_CATEGORY_ICONS, atlasCategoryPresentation } from './atlas-category-presentation';

describe('Shared Atlas category icons', () => {
  it.each([
    ['Ambiente', 'eco'],
    ['Vitalidad Ecológica', 'eco'],
    ['Ciencia y Tecnología', 'science'],
    ['Economía', 'trending_up'],
    ['Educación', 'school'],
    ['Finanzas Públicas', 'account_balance'],
    ['Salud', 'health_and_safety'],
    ['Cultura', 'theater_comedy'],
    ['Atlas ULEAM', 'map'],
  ])('uses a recognizable icon for %s', (name, icon) => {
    expect(atlasCategoryPresentation(name).icon).toBe(icon);
  });
  it('handles new category names without requiring a database change', () => {
    expect(atlasCategoryPresentation('Nueva categoría').icon).toBe('folder_open');
    expect(atlasCategoryPresentation('')).toEqual(atlasCategoryPresentation('Nueva categoría'));
  });
  it('prefers a chosen icon and retains the category theme', () => {
    expect(atlasCategoryPresentation('Ambiente', 'science')).toEqual({
      icon: 'science',
      color: atlasCategoryPresentation('Ambiente').color,
    });
    expect(atlasCategoryPresentation('Ambiente', null).icon).toBe('eco');
    expect(atlasCategoryPresentation('Ambiente', 'invalid_icon').icon).toBe('eco');
  });
  it('offers distinct, valid Material icon names', () => {
    expect(new Set(ATLAS_CATEGORY_ICONS.map((icon) => icon.value)).size).toBe(
      ATLAS_CATEGORY_ICONS.length,
    );
    for (const icon of ATLAS_CATEGORY_ICONS) expect(icon.value).toMatch(/^[a-z_]+$/);
  });
});
