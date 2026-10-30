export interface Call {
  method: string;
  /** Path and query, without the host and `/api/v3`. */
  path: string;
  body?: any;
}

/**
 * Stands in for `fetch` against Radarr/Sonarr: `handler` answers each call with
 * a JSON-able value, and every call is recorded in the returned array.
 */
export function fakeArr(handler: (call: Call) => unknown): Call[] {
  const calls: Call[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const call: Call = {
      method: init?.method ?? 'GET',
      path: url.replace(/^https?:\/\/[^/]+\/api\/v3/, ''),
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    };
    calls.push(call);
    const answer = handler(call);
    return {
      ok: true,
      status: 200,
      text: async () => (answer === undefined ? '' : JSON.stringify(answer)),
    };
  }) as unknown as typeof fetch;
  return calls;
}

export const config = {
  url: 'http://nas:7878',
  apiKey: 'key',
  qualityProfileId: 4,
  rootFolderPath: '/data/media',
};
