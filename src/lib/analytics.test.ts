import { screenNameFromPath } from './analytics';

describe('screenNameFromPath', () => {
  it('leaves static routes alone', () => {
    expect(screenNameFromPath('/')).toBe('/');
    expect(screenNameFromPath('/search')).toBe('/search');
    expect(screenNameFromPath('/edit-profile')).toBe('/edit-profile');
    expect(screenNameFromPath('/(tabs)/library')).toBe('/(tabs)/library');
  });

  it('collapses tmdb ids, so one screen stays one row in PostHog', () => {
    expect(screenNameFromPath('/media/550')).toBe('/media/[id]');
    expect(screenNameFromPath('/media/1399')).toBe(screenNameFromPath('/media/550'));
  });

  it('collapses entry and profile uuids', () => {
    expect(screenNameFromPath('/friend/3f1a7c9e-2b4d-4a6f-8c1e-9d0b7a5f3c21')).toBe('/friend/[id]');
  });

  it('keeps segments that merely contain digits', () => {
    expect(screenNameFromPath('/media/top-10')).toBe('/media/top-10');
  });
});
