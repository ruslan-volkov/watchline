/**
 * Why a push registration attempt ended. The five ways registration can fall
 * through used to be indistinguishable — the caller got `void` either way — so
 * an account with no token looked exactly like a registered one.
 */
export type PushRegistrationResult =
  | 'registered'
  | 'not-a-device'
  | 'no-project-id'
  | 'permission-denied'
  | 'write-failed'
  | 'error';

/** The platform edges an attempt leans on, passed in so the logic stays testable. */
export interface PushRegistrationEnv {
  isDevice: boolean;
  projectId: string | undefined;
  getPermissions: () => Promise<{ granted: boolean }>;
  requestPermissions: () => Promise<{ granted: boolean }>;
  /** Android needs a channel before a token can be issued; a no-op elsewhere. */
  prepareChannel: () => Promise<void>;
  getToken: (projectId: string) => Promise<string>;
  saveToken: (token: string) => Promise<{ error: unknown }>;
}

/**
 * Walk the registration steps and name the step that stopped us. Nothing here
 * is silent: every return is a reason the UI can show.
 */
export async function attemptPushRegistration(
  env: PushRegistrationEnv,
): Promise<PushRegistrationResult> {
  try {
    if (!env.isDevice) return 'not-a-device';
    if (!env.projectId) return 'no-project-id';

    const existing = await env.getPermissions();
    const granted = existing.granted || (await env.requestPermissions()).granted;
    if (!granted) return 'permission-denied';

    await env.prepareChannel();

    const token = await env.getToken(env.projectId);
    // The upsert's error was previously dropped on the floor, which made a
    // rejected write look like a delivered token.
    const { error } = await env.saveToken(token);
    return error ? 'write-failed' : 'registered';
  } catch (_e) {
    return 'error';
  }
}
