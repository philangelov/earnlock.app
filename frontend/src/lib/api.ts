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
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
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
    // Only tear the session down if it's still the one we tried to refresh. A sign-in that
    // landed while this refresh was in flight — common when a stale or server-deleted
    // session is cleaned up at launch — must not have its fresh tokens wiped.
    if ((await readKey(REFRESH_KEY)) === refreshToken) await clearSession();
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

  const originalToken = auth ? await readKey(ACCESS_KEY) : null;
  let token = originalToken;
  let res = await send(path, options, token);

  // Exactly one retry: an expired access token is the common case, and replaying the
  // request is invisible to the caller. A second 401 means the session is really gone.
  if (res.status === 401 && auth && token) {
    token = await refreshSession();
    if (token) res = await send(path, options, token);
  }

  const data = (await parse(res)) as { error?: { code: string; message: string } } | null;

  if (!res.ok) {
    // Same guard as the refresh path: only drop the session if the token this request used
    // is still the stored one. If a concurrent sign-in replaced it, keep the new session —
    // this is what stops a leftover session's 401 from clobbering a fresh sign-in.
    if (res.status === 401 && auth && (await readKey(ACCESS_KEY)) === originalToken) {
      await clearSession();
    }
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

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  /** School subject the question belongs to; null when the generator didn't label it. */
  subject: string | null;
};
/**
 * The closing fill-in-the-blank, authored by the server from the same material the
 * questions came from.
 *
 * Unlike a question, it ships with its `answer`. That is safe: the recap is a review
 * exercise, not a graded one — `POST /quiz/submit` has already computed and credited the
 * reward by the time the recap screen renders, so nothing is mintable by reading it.
 */
export type QuizRecap = {
  sentence_before: string;
  /** Empty when the blank ends the sentence. */
  sentence_after: string;
  /** Three chips, one of which is `answer`. */
  options: string[];
  answer: string;
};

export type GeneratedQuiz = {
  quiz_id: string;
  source: string;
  question_count: number;
  questions: QuizQuestion[];
  recap: QuizRecap;
  generated_at: string;
};

/**
 * Generate a quiz. With no argument it draws on the learner's profile (grade + focus
 * subjects); pass a `materialId` to generate from a specific imported material, which also
 * makes the reward count toward that material's understanding (server-side, migration 0016).
 */
export function generateQuiz(opts?: { materialId?: string }): Promise<GeneratedQuiz> {
  const body = opts?.materialId ? { source: 'material', material_id: opts.materialId } : {};
  return request<GeneratedQuiz>('/quiz/generate', { method: 'POST', body });
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

export type Balance = {
  /** Seconds left on the window, computed against the SERVER's clock. Never negative. */
  remaining_seconds: number;
  /** The instant the shield returns. `null` before any time has ever been earned. */
  unlocked_until: string | null;
  updated_at: string | null;
};

/**
 * The wallet is a deadline, not a countdown: earning extends `unlocked_until` and
 * wall-clock time consumes it. Reading it can never re-grant it — which is the bug this
 * shape exists to make impossible.
 */
export function getBalance(): Promise<Balance> {
  return request<Balance>('/screentime/balance');
}

/* --------------------------------------------------------------------- account */

/**
 * Hard-delete the signed-in account. Cascades through every table; there is no undo and
 * no tombstone. The caller must clear its own session afterwards.
 */
export async function deleteAccount(): Promise<void> {
  await request<null>('/account', { method: 'DELETE' });
  await clearSession();
}

/* ----------------------------------------------------------------------- stats */

export type StatsTotals = {
  quizzes: number;
  questions_answered: number;
  questions_correct: number;
  /** null — not 0 — when nothing has been answered. "No data" ≠ "got everything wrong". */
  accuracy: number | null;
  earned_seconds: number;
  spent_seconds: number;
  remaining_seconds: number;
};

export type StatsStreak = { current: number; best: number; active_today: boolean };

/** One local calendar day. The series is always exactly 7 entries, oldest first. */
export type StatsDay = {
  date: string;
  quizzes: number;
  correct: number;
  total: number;
  earned_seconds: number;
};

export type StatsSubject = {
  subject: string;
  correct: number;
  total: number;
  accuracy: number | null;
};

/** One imported material with how well it's been understood. `accuracy` is null until at
 *  least one question drawn from it has been answered (migration 0016). */
export type StatsMaterial = {
  material_id: string;
  title: string;
  source_type: 'text' | 'link' | 'file';
  preview: string;
  correct: number;
  total: number;
  accuracy: number | null;
  created_at: string;
};

/** One completed quiz. `total_count` is null for attempts recorded before the
 *  server started storing the denominator (migration 0014). */
export type QuizAttempt = {
  quiz_id: string;
  correct_count: number;
  total_count: number | null;
  earned_seconds: number;
  created_at: string;
};

export type Stats = {
  totals: StatsTotals;
  streak: StatsStreak;
  daily: StatsDay[];
  subjects: StatsSubject[];
  /** Every imported material with its per-material understanding. Newest first. */
  materials: StatsMaterial[];
  /** Newest first, up to the 30 most recent attempts. */
  recent: QuizAttempt[];
};

/**
 * Every number the Insights tab and the Learn roadmap display.
 *
 * The device's UTC offset rides along because a streak is a local-calendar notion: a
 * quiz finished at 23:30 in Sofia belongs to that day, not to the next one as UTC
 * would have it. `getTimezoneOffset()` is minutes *behind* UTC, so it is negated.
 */
export function getStats(): Promise<Stats> {
  const tzOffset = -new Date().getTimezoneOffset();
  return request<Stats>(`/stats?tz_offset=${tzOffset}`);
}

/* -------------------------------------------------------------- knowledge import */

export type ImportedMaterial = {
  material_id: string;
  title: string;
  source_type: 'text' | 'link' | 'file';
  preview: string;
  created_at: string;
};

/** Import pasted study material. An optional `title` names it in the Materials manager;
 *  the server derives one from the text when it's omitted. */
export function importText(rawText: string, title?: string): Promise<ImportedMaterial> {
  return request<ImportedMaterial>('/knowledge/import', {
    method: 'POST',
    body: { source_type: 'text', raw_text: rawText, ...(title ? { title } : {}) },
  });
}

/**
 * Import an uploaded file (a PDF or a photo of a worksheet/page). The bytes travel as
 * base64; the server transcribes the study text out of the file with the AI model and
 * stores that text — so a file becomes an ordinary material the quiz engine can draw on.
 * The request is larger and slower than a paste (the model has to read the file), so the
 * caller should show a "reading your file" state while it runs.
 */
export function importFile(opts: {
  data: string;
  mimeType: string;
  filename?: string;
}): Promise<ImportedMaterial> {
  return request<ImportedMaterial>('/knowledge/import', {
    method: 'POST',
    body: {
      source_type: 'file',
      data: opts.data,
      mime_type: opts.mimeType,
      ...(opts.filename ? { filename: opts.filename } : {}),
    },
  });
}

/** Delete an imported material. Its per-material understanding goes with it; quiz history
 *  built while studying it is kept (the server nulls the link, not the row). */
export function deleteMaterial(materialId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/knowledge/${materialId}`, { method: 'DELETE' });
}
