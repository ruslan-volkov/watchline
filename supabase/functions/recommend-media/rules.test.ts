import {
  MAX_NUDGES,
  MESSAGE_MAX_LENGTH,
  NUDGE_COOLDOWN_MS,
  cleanMessage,
  nudgeBlock,
  nudgeCopy,
  recommendationCopy,
} from './rules';

const now = Date.parse('2026-10-31T12:00:00Z');
const ago = (ms: number) => new Date(now - ms).toISOString();

describe('nudgeBlock', () => {
  it('allows the first nudge', () => {
    expect(nudgeBlock({ nudge_count: 0, last_nudged_at: null }, now)).toBeNull();
  });

  it('refuses a nudge inside the cooldown', () => {
    const rec = { nudge_count: 1, last_nudged_at: ago(NUDGE_COOLDOWN_MS - 1000) };
    expect(nudgeBlock(rec, now)).toBe('cooldown');
  });

  it('allows a nudge once the cooldown is over', () => {
    const rec = { nudge_count: 1, last_nudged_at: ago(NUDGE_COOLDOWN_MS) };
    expect(nudgeBlock(rec, now)).toBeNull();
  });

  it('refuses for good once the limit is reached, however old the last nudge', () => {
    const rec = { nudge_count: MAX_NUDGES, last_nudged_at: ago(NUDGE_COOLDOWN_MS * 30) };
    expect(nudgeBlock(rec, now)).toBe('limit');
  });
});

describe('cleanMessage', () => {
  it('trims the text', () => {
    expect(cleanMessage('  tu vas adorer  ')).toBe('tu vas adorer');
  });

  it('treats a blank or missing message as none', () => {
    expect(cleanMessage('   ')).toBeNull();
    expect(cleanMessage(undefined)).toBeNull();
    expect(cleanMessage(42)).toBeNull();
  });

  it('caps a message so it cannot trip the database check', () => {
    expect(cleanMessage('x'.repeat(MESSAGE_MAX_LENGTH + 10))).toHaveLength(MESSAGE_MAX_LENGTH);
  });
});

describe('push copy', () => {
  it('names the sender and the title, and carries the message', () => {
    expect(recommendationCopy('julie', 'Severance', 'Regarde ça')).toEqual({
      title: '@julie te recommande Severance',
      body: 'Regarde ça',
    });
    expect(nudgeCopy('julie', 'Severance', 'Alors ?')).toEqual({
      title: '@julie te relance pour Severance',
      body: 'Alors ?',
    });
  });

  it('still has a body without a message', () => {
    expect(recommendationCopy('julie', 'Severance', null).body).not.toBe('');
    expect(nudgeCopy('julie', 'Severance', null).body).not.toBe('');
  });

  it('copes with a sender who has no username', () => {
    expect(recommendationCopy(null, 'Severance', null).title).toBe(
      'Quelqu’un te recommande Severance',
    );
  });
});
