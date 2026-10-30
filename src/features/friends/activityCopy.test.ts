import { activityLine, emptyActivityCopy } from './activityCopy';
import type { FriendProfile } from './api';

const profile = (activity_visible: boolean): FriendProfile => ({
  id: 'u1',
  username: 'Ruslan',
  avatar_url: null,
  activity_visible,
});

describe('activityLine', () => {
  it('names what the friend is watching', () => {
    expect(activityLine('Severance', profile(true))).toBe('Regarde Severance');
  });

  it('only says "masquée" when the friend actually hid their activity', () => {
    expect(activityLine(null, profile(false))).toBe('Activité masquée');
    // Sharing, but nothing in progress — the old copy accused them of hiding.
    expect(activityLine(null, profile(true))).toBe('Rien en cours');
    expect(activityLine(null, null)).toBe('Rien en cours');
  });

  it('shows the title even if the profile is unknown', () => {
    expect(activityLine('Dark', null)).toBe('Regarde Dark');
  });
});

describe('emptyActivityCopy', () => {
  it('tells a stranger apart from a friend', () => {
    expect(emptyActivityCopy(undefined, 'Ruslan').title).toBe('Pas encore ami');
  });

  it('explains a pending request instead of blaming the other side', () => {
    expect(emptyActivityCopy({ relation: 'outgoing', profile: profile(true) }, 'Ruslan').title).toBe(
      'Demande en attente',
    );
    expect(emptyActivityCopy({ relation: 'incoming', profile: profile(true) }, 'Ruslan').title).toBe(
      'Demande en attente',
    );
  });

  it('distinguishes a hidden friend from an empty one', () => {
    expect(emptyActivityCopy({ relation: 'friend', profile: profile(false) }, 'Ruslan').title).toBe(
      'Activité masquée',
    );
    expect(emptyActivityCopy({ relation: 'friend', profile: profile(true) }, 'Ruslan').title).toBe(
      'Rien pour l’instant',
    );
  });

  it('addresses the friend by name', () => {
    expect(emptyActivityCopy({ relation: 'friend', profile: profile(false) }, 'Ruslan').message).toContain(
      'Ruslan',
    );
  });
});
