import { attemptPushRegistration, type PushRegistrationEnv } from './attempt';

function env(over: Partial<PushRegistrationEnv> = {}): PushRegistrationEnv {
  return {
    isDevice: true,
    projectId: 'proj-1',
    getPermissions: async () => ({ granted: true }),
    requestPermissions: async () => ({ granted: true }),
    prepareChannel: async () => {},
    getToken: async () => 'ExponentPushToken[abc]',
    saveToken: async () => ({ error: null }),
    ...over,
  };
}

describe('attemptPushRegistration', () => {
  it('registers and stores the token when everything is available', async () => {
    const saved: string[] = [];
    const result = await attemptPushRegistration(
      env({
        saveToken: async (token) => {
          saved.push(token);
          return { error: null };
        },
      }),
    );
    expect(result).toBe('registered');
    expect(saved).toEqual(['ExponentPushToken[abc]']);
  });

  it('reports a simulator instead of giving up quietly', async () => {
    expect(await attemptPushRegistration(env({ isDevice: false }))).toBe('not-a-device');
  });

  it('reports a build without an EAS project id', async () => {
    expect(await attemptPushRegistration(env({ projectId: undefined }))).toBe('no-project-id');
  });

  it('reports a refused permission', async () => {
    const result = await attemptPushRegistration(
      env({
        getPermissions: async () => ({ granted: false }),
        requestPermissions: async () => ({ granted: false }),
      }),
    );
    expect(result).toBe('permission-denied');
  });

  it('asks for the permission only when it is not already granted', async () => {
    let asked = 0;
    await attemptPushRegistration(
      env({
        requestPermissions: async () => {
          asked += 1;
          return { granted: true };
        },
      }),
    );
    expect(asked).toBe(0);

    await attemptPushRegistration(
      env({
        getPermissions: async () => ({ granted: false }),
        requestPermissions: async () => {
          asked += 1;
          return { granted: true };
        },
      }),
    );
    expect(asked).toBe(1);
  });

  it('tells a rejected write apart from a successful one', async () => {
    const result = await attemptPushRegistration(
      env({
        saveToken: async () => ({ error: { message: 'new row violates row-level security' } }),
      }),
    );
    expect(result).toBe('write-failed');
  });

  it('prepares the notification channel before asking for a token', async () => {
    const steps: string[] = [];
    await attemptPushRegistration(
      env({
        prepareChannel: async () => {
          steps.push('channel');
        },
        getToken: async () => {
          steps.push('token');
          return 'ExponentPushToken[abc]';
        },
      }),
    );
    expect(steps).toEqual(['channel', 'token']);
  });

  it('passes the project id through to the token request', async () => {
    let seen: string | undefined;
    await attemptPushRegistration(
      env({
        projectId: 'proj-2',
        getToken: async (projectId) => {
          seen = projectId;
          return 'ExponentPushToken[abc]';
        },
      }),
    );
    expect(seen).toBe('proj-2');
  });

  it('surfaces a thrown token request as an error rather than a success', async () => {
    const result = await attemptPushRegistration(
      env({
        getToken: async () => {
          throw new Error('network request failed');
        },
      }),
    );
    expect(result).toBe('error');
  });

  it('surfaces a thrown permission check as an error', async () => {
    const result = await attemptPushRegistration(
      env({
        getPermissions: async () => {
          throw new Error('unavailable');
        },
      }),
    );
    expect(result).toBe('error');
  });
});
