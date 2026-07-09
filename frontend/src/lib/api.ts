/**
 * Thin fetch wrapper for the EarnLock backend (docs/api-contract.md). One function per
 * endpoint, all going through `request()` so auth headers, JSON parsing and the
 * `{error:{code,message}}` envelope are handled in exactly one place.
 *
 * The JWT is persisted in expo-secure-store (iOS Keychain / Android Keystore) since it's
 * a credential, not app state — it deliberately does NOT live in the Zustand/AsyncStorage
 * store alongside onboarding progress. SecureStore has no web implementation, so web falls
 * back to localStorage (fine for local dev/testing; native is the real target platform).
 */
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const API_URL: string = Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:5000';

const isWeb = process.env.EXPO_OS === 'web';
const TOKEN_KEY = 'earnlock-jwt';

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function getToken(): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setToken(token: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function clearToken(): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  /** Attach the stored JWT. Only /auth/register and /auth/login skip this. */
  auth?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = data?.error ?? { code: 'unknown_error', message: 'Request failed.' };
    throw new ApiError(err.code, err.message, res.status);
  }

  return data as T;
}

// --- Auth --------------------------------------------------------------------------

export type AuthUser = { id: string; email: string; grade_or_age: string };
export type AuthResponse = { user: AuthUser; token: string };

export async function register(
  email: string,
  password: string,
  gradeOrAge: string,
): Promise<AuthResponse> {
  const res = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, grade_or_age: gradeOrAge },
    auth: false,
  });
  await setToken(res.token);
  return res;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
  await setToken(res.token);
  return res;
}

export async function logout(): Promise<void> {
  await clearToken();
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getToken()) != null;
}

// --- Profile -------------------------------------------------------------------------

export type Profile = {
  user_id: string;
  grade_or_age: string;
  focus_subjects: string[];
  sos_debt_flag: boolean;
  last_sos_date: string | null;
  wakeup_completed_date: string | null;
};

export function getProfile(): Promise<Profile> {
  return request<Profile>('/profile');
}

// --- Quiz ------------------------------------------------------------------------------

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

// --- Screentime balance ---------------------------------------------------------------

export type Balance = { remaining_seconds: number; updated_at: string | null };

export function getBalance(): Promise<Balance> {
  return request<Balance>('/screentime/balance');
}

// --- Knowledge import ------------------------------------------------------------------

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

export function listMaterials(): Promise<{ materials: ImportedMaterial[] }> {
  return request('/knowledge');
}
