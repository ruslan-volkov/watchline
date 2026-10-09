import type {
  EpisodeInfo,
  MediaDetails,
  MediaProvider,
  MediaSummary,
  MediaType,
  SeasonInfo,
} from './types';

/** Days offset from today -> ISO date (YYYY-MM-DD). Keeps the demo timeline alive. */
function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function makeSeason(
  seasonNumber: number,
  count: number,
  titles: string[],
  firstAirOffset: number,
): SeasonInfo {
  const episodes: EpisodeInfo[] = [];
  for (let i = 0; i < count; i += 1) {
    // One episode a week; some land in the future to populate the timeline.
    episodes.push({
      seasonNumber,
      episodeNumber: i + 1,
      title: titles[i] ?? `Épisode ${i + 1}`,
      airDate: offsetDate(firstAirOffset + i * 7),
    });
  }
  return { seasonNumber, name: `Saison ${seasonNumber}`, episodes };
}

interface MockEntry extends MediaDetails {}

const MOVIES: MockEntry[] = [
  {
    tmdbId: 100001,
    mediaType: 'movie',
    title: 'Les échos du silence',
    posterPath: null,
    releaseDate: offsetDate(0),
    overview: 'Un drame intime sur la mémoire et l’oubli.',
  },
  {
    tmdbId: 100002,
    mediaType: 'movie',
    title: 'Comète',
    posterPath: null,
    releaseDate: offsetDate(1),
    overview: 'Deux astronomes traquent un objet qui ne devrait pas exister.',
  },
  {
    tmdbId: 100003,
    mediaType: 'movie',
    title: 'La dernière ligne',
    posterPath: null,
    releaseDate: offsetDate(4),
    overview: 'Un thriller ferroviaire en temps réel.',
  },
  {
    tmdbId: 100004,
    mediaType: 'movie',
    title: 'Jardin d’hiver',
    posterPath: null,
    releaseDate: offsetDate(12),
    overview: 'Une comédie douce-amère sur une famille recomposée.',
  },
  {
    tmdbId: 100005,
    mediaType: 'movie',
    title: 'Nord magnétique',
    posterPath: null,
    releaseDate: offsetDate(-40),
    overview: 'Expédition polaire et huis clos glacé.',
  },
  {
    tmdbId: 100006,
    mediaType: 'movie',
    title: 'Papier mâché',
    posterPath: null,
    releaseDate: offsetDate(-120),
    overview: 'Le portrait d’une artiste au bord de la rupture.',
  },
];

const SERIES: MockEntry[] = [
  {
    tmdbId: 200001,
    mediaType: 'tv',
    title: 'Marée haute',
    posterPath: null,
    releaseDate: offsetDate(-200),
    overview: 'Une brigade côtière face à une série de disparitions.',
    seasons: [
      makeSeason(1, 8, [
        'Le rivage',
        'Contre-courant',
        'Fond de cale',
        'Étale',
        'Ressac',
        'Écume',
        'Lame de fond',
        'Marée basse',
      ], -180),
      makeSeason(2, 8, [
        'Retour au port',
        'Brume',
        'Filets',
        'Tempête',
        'Phare',
        'Récif',
        'Naufrage',
        'Accalmie',
      ], -6),
    ],
  },
  {
    tmdbId: 200002,
    mediaType: 'tv',
    title: 'Bureau 14',
    posterPath: null,
    releaseDate: offsetDate(-90),
    overview: 'Comédie de bureau sur une équipe qui ne devrait pas exister.',
    seasons: [
      makeSeason(1, 6, [
        'Premier jour',
        'La réunion',
        'Le stagiaire',
        'Pot de départ',
        'Audit',
        'Séminaire',
      ], -70),
    ],
  },
  {
    tmdbId: 200003,
    mediaType: 'tv',
    title: 'Signal',
    posterPath: null,
    releaseDate: offsetDate(2),
    overview: 'Science-fiction : un message reçu 30 ans trop tard.',
    seasons: [
      makeSeason(1, 10, [
        'Réception',
        'Bruit blanc',
        'Fréquence',
        'Écho',
        'Latence',
        'Boucle',
        'Interférence',
        'Portée',
        'Silence radio',
        'Émission',
      ], 2),
    ],
  },
  {
    tmdbId: 200004,
    mediaType: 'tv',
    title: 'Racines amères',
    posterPath: null,
    releaseDate: offsetDate(-300),
    overview: 'Saga familiale dans un vignoble en déclin.',
    seasons: [
      makeSeason(1, 8, [], -290),
      makeSeason(2, 8, [], -140),
      makeSeason(3, 8, [], 5),
    ],
  },
];

const ALL: MockEntry[] = [...MOVIES, ...SERIES];

function toSummary(e: MockEntry): MediaSummary {
  const { seasons, ...summary } = e;
  return summary;
}

async function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const mockMediaProvider: MediaProvider = {
  async search(query: string): Promise<MediaSummary[]> {
    const q = query.trim().toLowerCase();
    if (!q) return delay(ALL.map(toSummary));
    const matches = ALL.filter((e) => e.title.toLowerCase().includes(q));
    return delay(matches.map(toSummary));
  },

  async getDetails(tmdbId: number, mediaType: MediaType): Promise<MediaDetails | null> {
    const found = ALL.find((e) => e.tmdbId === tmdbId && e.mediaType === mediaType);
    return delay(found ?? null);
  },

  async getShowStatus(tmdbId: number) {
    // Derived from the mock's own episode lists, so the shape matches TMDB's.
    const details = await mockMediaProvider.getDetails(tmdbId, 'tv');
    const today = new Date().toISOString().slice(0, 10);
    const dated = (details?.seasons ?? [])
      .flatMap((s) => s.episodes)
      .filter((e) => !!e.airDate);
    const aired = dated.filter((e) => e.airDate! <= today);
    return {
      status: details?.status ?? null,
      lastAirDate: aired[aired.length - 1]?.airDate ?? null,
      lastEpisodeToAir: aired[aired.length - 1] ?? null,
      nextEpisodeToAir: dated.find((e) => e.airDate! > today) ?? null,
    };
  },

  async trending(): Promise<MediaSummary[]> {
    return delay(ALL.map(toSummary));
  },
};
