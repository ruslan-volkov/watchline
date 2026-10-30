import { aggregateState, stateFromQueueItem, stateLabel, type DownloadState } from './state';

const downloaded: DownloadState = { kind: 'downloaded' };
const none: DownloadState = { kind: 'none' };

describe('stateFromQueueItem', () => {
  it('turns size and sizeleft into a progress', () => {
    expect(stateFromQueueItem({ status: 'downloading', size: 1000, sizeleft: 250 })).toEqual({
      kind: 'downloading',
      progress: 0.75,
    });
  });

  it('calls a waiting download queued', () => {
    expect(stateFromQueueItem({ status: 'queued', size: 1000, sizeleft: 1000 })).toEqual({ kind: 'queued' });
    expect(stateFromQueueItem({ status: 'paused', size: 1000, sizeleft: 1000 })).toEqual({ kind: 'queued' });
  });

  it('does not divide by a missing size', () => {
    expect(stateFromQueueItem({ status: 'downloading' })).toEqual({ kind: 'downloading', progress: 0 });
  });
});

describe('aggregateState', () => {
  it('is none for nothing', () => {
    expect(aggregateState([])).toEqual(none);
  });

  it('is downloaded only when every episode is', () => {
    expect(aggregateState([downloaded, downloaded])).toEqual(downloaded);
  });

  it('reports a part on the NAS as partial', () => {
    expect(aggregateState([downloaded, none, none])).toEqual({ kind: 'partial', done: 1, total: 3 });
  });

  it('averages the progress of what is downloading', () => {
    expect(
      aggregateState([
        { kind: 'downloading', progress: 0.2 },
        { kind: 'downloading', progress: 0.6 },
        downloaded,
      ]),
    ).toEqual({ kind: 'downloading', progress: 0.4 });
  });

  it('prefers movement over a wish', () => {
    expect(aggregateState([{ kind: 'wanted' }, { kind: 'queued' }])).toEqual({ kind: 'queued' });
  });
});

describe('stateLabel', () => {
  it('shows the idle text only when nothing happened', () => {
    expect(stateLabel(none, 'Télécharger')).toBe('Télécharger');
    expect(stateLabel({ kind: 'downloading', progress: 0.424 }, 'x')).toBe('Téléchargement · 42 %');
    expect(stateLabel({ kind: 'partial', done: 3, total: 10 }, 'x')).toBe('3/10 sur le NAS');
  });
});
