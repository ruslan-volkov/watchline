// What a Radarr / Sonarr webhook means for the user, as a push message. Kept free
// of Deno APIs so Jest can test it.

export interface PushText {
  title: string;
  body: string;
}

interface WebhookEvent {
  eventType?: string;
  isUpgrade?: boolean;
  movie?: { title?: string; year?: number };
  series?: { title?: string };
  episodes?: { seasonNumber?: number; episodeNumber?: number }[];
}

const pad = (n: number | undefined) => String(n ?? 0).padStart(2, '0');

/**
 * `Test` (the button in Radarr/Sonarr) confirms the wiring; `Download` is a
 * finished import. Anything else, and upgrades of a file already imported, say
 * nothing — returns null.
 */
export function describeEvent(event: WebhookEvent): PushText | null {
  if (event.eventType === 'Test') {
    return {
      title: 'NAS connecté',
      body: 'Tu seras prévenu ici quand un téléchargement est terminé.',
    };
  }
  if (event.eventType !== 'Download' || event.isUpgrade) return null;

  if (event.movie?.title) {
    const year = event.movie.year ? ` (${event.movie.year})` : '';
    return { title: 'Téléchargement terminé', body: `${event.movie.title}${year} est sur le NAS.` };
  }

  if (event.series?.title) {
    const episodes = event.episodes ?? [];
    if (episodes.length > 1) {
      return {
        title: 'Téléchargement terminé',
        body: `${event.series.title} : ${episodes.length} épisodes sont sur le NAS.`,
      };
    }
    const what =
      episodes.length === 1
        ? ` S${pad(episodes[0].seasonNumber)}E${pad(episodes[0].episodeNumber)}`
        : '';
    return {
      title: 'Téléchargement terminé',
      body: `${event.series.title}${what} est sur le NAS.`,
    };
  }
  return null;
}
