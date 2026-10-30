#!/usr/bin/env node
// A stand-in for Radarr (7878) and Sonarr (8989), just faithful enough for the
// NAS screens: the same endpoints, in memory, with downloads that finish by
// themselves. Used by the Maestro flow (see .maestro/nas-download.yaml) and handy
// for trying the app without a NAS:   node scripts/fake-arr.mjs
// API key: test-key.
import http from 'node:http';

const API_KEY = 'test-key';
const PROFILES = [
  { id: 1, name: 'HD-1080p MULTi' },
  { id: 2, name: 'UHD-4K' },
];
// Season 0 is a special; Sonarr loads episodes a moment after a series is added.
const SEASONS = [0, 1, 2, 3];
const EPISODES_PER_SEASON = 12;
const EPISODES_DELAY_MS = 2_000;
const TICK_MS = 700;
const STEP = 0.34;

const movies = new Map(); // tmdbId -> movie
const series = new Map(); // tvdbId -> series
const episodes = []; // all episodes of all series
let nextId = 1;

// Each tick moves everything queued along; at 100 % the file "arrives".
setInterval(() => {
  for (const item of [...movies.values(), ...episodes]) {
    if (item.progress === null) continue;
    item.progress += STEP;
    if (item.progress >= 1) {
      item.progress = null;
      item.hasFile = true;
    }
  }
}, TICK_MS);

const queueItem = (item, extra) => ({
  status: item.progress === 0 ? 'queued' : 'downloading',
  size: 1000,
  sizeleft: Math.round(1000 * (1 - item.progress)),
  ...extra,
});

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
}

const radarr = async ({ method, path, query, body }) => {
  if (path === '/system/status') return { appName: 'Radarr', version: '5.0.0-fake' };
  if (path === '/rootfolder') return [{ id: 1, path: '/data/media/movies' }];
  if (path === '/movie' && method === 'GET') {
    const movie = movies.get(Number(query.get('tmdbId')));
    return movie ? [movie] : [];
  }
  if (path === '/movie/lookup') {
    const tmdbId = Number(query.get('term').replace('tmdb:', ''));
    return [{ id: 0, tmdbId, title: `Film ${tmdbId}` }];
  }
  if (path === '/movie' && method === 'POST') {
    const movie = { ...body, id: nextId++, hasFile: false, progress: body.addOptions?.searchForMovie ? 0 : null };
    movies.set(movie.tmdbId, movie);
    return movie;
  }
  if (path === '/movie/editor') {
    for (const id of body.movieIds) {
      const movie = [...movies.values()].find((m) => m.id === id);
      if (movie) Object.assign(movie, { monitored: body.monitored, ...(body.qualityProfileId && { qualityProfileId: body.qualityProfileId }) });
    }
    return undefined;
  }
  if (path === '/command' && body.name === 'MoviesSearch') {
    for (const id of body.movieIds) {
      const movie = [...movies.values()].find((m) => m.id === id);
      if (movie && !movie.hasFile) movie.progress = 0;
    }
    return {};
  }
  if (path === '/queue/details') {
    const movie = [...movies.values()].find((m) => m.id === Number(query.get('movieId')));
    return movie && movie.progress !== null ? [queueItem(movie)] : [];
  }
  return null;
};

const sonarr = async ({ method, path, query, body }) => {
  if (path === '/system/status') return { appName: 'Sonarr', version: '4.0.0-fake' };
  if (path === '/rootfolder') return [{ id: 1, path: '/data/media/tv' }];
  if (path === '/series' && method === 'GET') {
    const found = series.get(Number(query.get('tvdbId')));
    return found ? [found] : [];
  }
  if (path === '/series/lookup') {
    const tvdbId = Number(query.get('term').replace('tvdb:', ''));
    return [{ id: 0, tvdbId, title: `Série ${tvdbId}` }];
  }
  if (path === '/series' && method === 'POST') {
    const created = { ...body, id: nextId++ };
    series.set(created.tvdbId, created);
    setTimeout(() => {
      for (const seasonNumber of SEASONS) {
        for (let episodeNumber = 1; episodeNumber <= (seasonNumber === 0 ? 1 : EPISODES_PER_SEASON); episodeNumber++) {
          episodes.push({ id: nextId++, seriesId: created.id, seasonNumber, episodeNumber, monitored: false, hasFile: false, progress: null });
        }
      }
    }, EPISODES_DELAY_MS);
    return created;
  }
  if (path === '/series/editor') return undefined;
  if (path === '/episode') return episodes.filter((e) => e.seriesId === Number(query.get('seriesId')));
  if (path === '/episode/monitor') {
    for (const e of episodes) if (body.episodeIds.includes(e.id)) e.monitored = body.monitored;
    return undefined;
  }
  if (path === '/command') {
    const wanted = episodes.filter((e) => {
      if (e.hasFile || !e.monitored) return false;
      if (body.name === 'SeriesSearch') return e.seriesId === body.seriesId;
      if (body.name === 'SeasonSearch') return e.seriesId === body.seriesId && e.seasonNumber === body.seasonNumber;
      if (body.name === 'EpisodeSearch') return body.episodeIds.includes(e.id);
      return false;
    });
    for (const e of wanted) e.progress = 0;
    return {};
  }
  if (path === '/queue/details') {
    return episodes
      .filter((e) => e.seriesId === Number(query.get('seriesId')) && e.progress !== null)
      .map((e) => queueItem(e, { episodeId: e.id }));
  }
  return null;
};

function serve(name, port, handler) {
  http
    .createServer(async (req, res) => {
      const url = new URL(req.url, 'http://fake');
      const path = url.pathname.replace(/^\/api\/v3/, '');
      console.log(`${name} ${req.method} ${path}${url.search}`);
      if (req.headers['x-api-key'] !== API_KEY) return send(res, 401);
      try {
        const answer = await handler({ method: req.method, path, query: url.searchParams, body: await readBody(req) });
        if (answer === null) return send(res, 404);
        send(res, 200, answer);
      } catch (e) {
        console.error(e);
        send(res, 500);
      }
    })
    .listen(port, () => console.log(`fake ${name} on :${port} (API key ${API_KEY})`));
}

// Both services answer /qualityprofile the same way.
const withProfiles = (handler) => (call) =>
  call.path === '/qualityprofile' ? PROFILES : handler(call);

serve('radarr', Number(process.env.RADARR_PORT ?? 7878), withProfiles(radarr));
serve('sonarr', Number(process.env.SONARR_PORT ?? 8989), withProfiles(sonarr));
