import { describeEvent } from './event';

describe('describeEvent', () => {
  it('announces a finished movie with its year', () => {
    expect(describeEvent({ eventType: 'Download', movie: { title: 'Dune', year: 2021 } })).toEqual({
      title: 'Téléchargement terminé',
      body: 'Dune (2021) est sur le NAS.',
    });
  });

  it('names a single episode', () => {
    expect(
      describeEvent({
        eventType: 'Download',
        series: { title: 'Severance' },
        episodes: [{ seasonNumber: 2, episodeNumber: 3 }],
      })?.body,
    ).toBe('Severance S02E03 est sur le NAS.');
  });

  it('counts episodes when several arrive at once', () => {
    expect(
      describeEvent({
        eventType: 'Download',
        series: { title: 'Severance' },
        episodes: [
          { seasonNumber: 1, episodeNumber: 1 },
          { seasonNumber: 1, episodeNumber: 2 },
        ],
      })?.body,
    ).toBe('Severance : 2 épisodes sont sur le NAS.');
  });

  it('confirms the wiring on a Test event', () => {
    expect(describeEvent({ eventType: 'Test' })?.title).toBe('NAS connecté');
  });

  it('stays quiet for upgrades and other events', () => {
    expect(
      describeEvent({ eventType: 'Download', isUpgrade: true, movie: { title: 'Dune' } }),
    ).toBeNull();
    expect(describeEvent({ eventType: 'Grab', movie: { title: 'Dune' } })).toBeNull();
    expect(describeEvent({})).toBeNull();
  });
});
