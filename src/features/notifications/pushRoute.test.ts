import { pushRoute } from './pushRoute';

describe('pushRoute', () => {
  it('opens the recommendations on a recommendation push', () => {
    expect(pushRoute({ type: 'recommendation' })).toBe('/recommendations');
  });

  it('opens the friends list on a friendship push', () => {
    expect(pushRoute({ type: 'friend_request' })).toBe('/friends');
    expect(pushRoute({ type: 'friend_accepted' })).toBe('/friends');
  });

  it('stays put on a push with no screen of its own, or an unknown one', () => {
    expect(pushRoute({ type: 'download_complete' })).toBeNull();
    expect(pushRoute({ type: 'from-a-newer-version' })).toBeNull();
    expect(pushRoute({ type: 42 })).toBeNull();
    expect(pushRoute({})).toBeNull();
    expect(pushRoute(null)).toBeNull();
  });
});
