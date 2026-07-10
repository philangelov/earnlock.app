/**
 * Thin fetch wrapper for the EarnLock backend (docs/api-contract.md). One function per
 * endpoint, all going through `request()` so auth headers, JSON parsing, token refresh and
 * the `{error:{code,message}}` envelope are handled in exactly one place.
 *
 * Tokens live in expo-secure-store (iOS Keychain / Android Keystore) since they are
 * credentials, not app state — they deliberately do NOT sit in the Zustand/AsyncStorage
 * store alongside onboarding progress. SecureStore has no web implementation, so web falls
 * back to localStorage (fine for local dev; native is the real target).
 *
 * Access tokens are short-lived. A 401 triggers exactly one refresh attempt, shared across
 * concurrent callers, and the original request is replayed. If the refresh fails the pair
 * is cleared and the caller sees `ApiError('unauthorized')`, which the UI reads as
 * "signed out" rather than "the server is broken".
 */
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { NativeModules } from 'react-native';

const isWeb = process.env.EXPO_OS === 'web';

const ACCESS_KEY = 'earnlock-jwt';
const REFRESH_KEY = 'earnlock-refresh';

/**
 * The development machine's address, or `undefined` when nothing is being served.
 *
 * `Constants.expoConfig.hostUri` is only populated where a manifest is fetched — Expo Go
 * and `expo-dev-client` builds. A plain `expo run:ios` build is `ExecutionEnvironment.Bare`
 * and has no manifest, so `hostUri` is undefined there and we ask Metro instead: the bundle
 * it served us came from the dev machine, so its URL carries the address we want.
 *
 * In a release build the bundle is a `file://` URL, the pattern misses, and callers keep
 * their configured origin.
 */
function devServerHost(): string | undefined {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return hostUri.split(':')[0];

  // The old architecture flattens constants onto the module; bridgeless keeps them behind
  // getConstants(). Ask for both rather than betting on which one is live.
  const sourceCode = NativeModules?.SourceCode as
    { scriptURL?: string; getConstants?: () => { scriptURL?: string } } | undefined;
  const scriptURL = sourceCode?.scriptURL ?? sourceCode?.getConstants?.().scriptURL;

  return /^https?:\/\/([^/:]+)/.exec(scriptURL ?? '')?.[1];
}

/**
 * `localhost` means the phone itself, not the Mac running Flask, so a device build talking
 * to a dev server would hang on a connection it can never make. Swap in the dev machine's
 * address. (iOS allows the resulting cleartext request because Info.plist sets
 * NSAllowsLocalNetworking.)
 *
 * A production `extra.apiUrl` is a real https host and is passed through untouched.
 */
function resolveApiUrl(): string {
  const configured: string = Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:5000';
  if (isWeb) return configured;

  const devHost = devServerHost();
  if (!devHost) return configured;

  return configured.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, `//${devHost}`);
}

const API_URL = resolveApiUrl().replace(/\/+$/, '');

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/* --------------------------------------------------------------- token storage */

async function readKey(key: string): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function writeKey(key: string, value: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteKey(key: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

async function storeSession(session: Session): Promise<void> {
  await writeKey(ACCESS_KEY, session.token);
  if (session.refresh_token) await writeKey(REFRESH_KEY, session.refresh_token);
}

async function clearSession(): Promise<void> {
  await Promise.all([deleteKey(ACCESS_KEY), deleteKey(REFRESH_KEY)]);
}

/* ------------------------------------------------------------------- transport */

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  /** Attach the stored access token. Only the /auth routes skip this. */
  auth?: boolean;
};

function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // A proxy or crash page — never let a JSON.parse blow up as an unhandled TypeError.
    throw new ApiError('unknown_error', 'The server sent a malformed response.', res.status);
  }
}

/** One shared refresh across concurrent 401s, so five parallel requests don't burn five
 *  refresh tokens (Supabase rotates them — the losers would be invalidated). */
let refreshInFlight: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = await readKey(REFRESH_KEY);
  if (!refreshToken) return null;

  const res = await send(
    '/auth/refresh',
    {
      method: 'POST',
      body: { refresh_token: refreshToken },
    },
    null,
  );

  if (!res.ok) {
    await clearSession();
    return null;
  }

  const session = (await parse(res)) as Session;
  await storeSession(session);
  return session.token;
}

function refreshSession(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().catch(() => null);
    void refreshInFlight.finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true } = options;

  let token = auth ? await readKey(ACCESS_KEY) : null;
  let res = await send(path, options, token);

  // Exactly one retry: an expired access token is the common case, and replaying the
  // request is invisible to the caller. A second 401 means the session is really gone.
  if (res.status === 401 && auth && token) {
    token = await refreshSession();
    if (token) res = await send(path, options, token);
  }

  const data = (await parse(res)) as { error?: { code: string; message: string } } | null;

  if (!res.ok) {
    if (res.status === 401) await clearSession();
    const err = data?.error ?? { code: 'unknown_error', message: 'Request failed.' };
    throw new ApiError(err.code, err.message, res.status);
  }

  return data as T;
}

/* ------------------------------------------------------------------------ auth */

export type AuthUser = { id: string; email: string | null; grade_or_age: string };
export type Session = {
  user: AuthUser;
  token: string;
  refresh_token: string | null;
  expires_in: number | null;
};

export type OAuthProvider = 'apple' | 'google';

/** Exchange a native Apple/Google identity token for an EarnLock session. */
export async function signInWithIdToken(
  provider: OAuthProvider,
  idToken: string,
  nonce?: string,
): Promise<Session> {
  const session = await request<Session>('/auth/oauth', {
    method: 'POST',
    body: { provider, id_token: idToken, ...(nonce ? { nonce } : {}) },
    auth: false,
  });
  await storeSession(session);
  return session;
}

export async function signOut(): Promise<void> {
  await clearSession();
}

export async function isAuthenticated(): Promise<boolean> {
  return (await readKey(ACCESS_KEY)) != null;
}

/* --------------------------------------------------------------------- profile */

export type Profile = {
  user_id: string;
  grade_or_age: string;
  focus_subjects: string[];
  sos_debt_flag: boolean;
  last_sos_date: string | null;
  wakeup_completed_date: string | null;
};

/** Partial update. The id_token grant carries no signup metadata, so this is how an
 *  OAuth account's grade stops being 'unspecified'. */
export function updateProfile(fields: {
  grade_or_age?: string;
  focus_subjects?: string[];
}): Promise<Profile> {
  return request<Profile>('/profile', { method: 'PUT', body: fields });
}

/* ------------------------------------------------------------------------ quiz */

export type QuizQuestion = { id: string; prompt: string; options: string[] };
export type GeneratedQuiz = {
  quiz_id: string;
  source: string;
  question_count: number;
  questions: QuizQuestion[];
  generated_at: string;
};

export function generateQuiz(): Promise<GeneratedQuiz> {
  return request<GeneratedQuiz>('/quiz/generate', { method: 'POST', body: {} });
}

export type QuizAnswer = { id: string; selected_index: number | null };
export type QuizResult = {
  id: string;
  correct: boolean;
  selected_index: number | null;
  correct_index: number;
  explanation: string | null;
};
export type QuizSubmitResponse = {
  quiz_id: string;
  correct_count: number;
  total: number;
  earned_seconds: number;
  new_balance_seconds: number;
  sos_debt_cleared: boolean;
  results: QuizResult[];
  submitted_at: string;
};

export function submitQuiz(quizId: string, answers: QuizAnswer[]): Promise<QuizSubmitResponse> {
  return request<QuizSubmitResponse>('/quiz/submit', {
    method: 'POST',
    body: { quiz_id: quizId, answers },
  });
}

/* ------------------------------------------------------------ screentime balance */

export type Balance = { remaining_seconds: number; updated_at: string | null };

export function getBalance(): Promise<Balance> {
  return request<Balance>('/screentime/balance');
}

/* -------------------------------------------------------------- knowledge import */

export type ImportedMaterial = {
  material_id: string;
  source_type: 'text' | 'link';
  preview: string;
  created_at: string;
};

export function importText(rawText: string): Promise<ImportedMaterial> {
  return request<ImportedMaterial>('/knowledge/import', {
    method: 'POST',
    body: { source_type: 'text', raw_text: rawText },
  });
}
