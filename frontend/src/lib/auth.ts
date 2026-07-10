/**
 * Native identity-token sign-in for Apple and Google. EarnLock has no passwords.
 *
 * Each provider hands back an OpenID Connect identity token, which the backend exchanges
 * with Supabase (`POST /auth/oauth` → `token?grant_type=id_token`). The token never gets
 * verified here — that's the whole point of doing the exchange server-side.
 *
 * Apple's nonce is the subtle part. We generate a raw nonce, hand Apple its SHA-256, and
 * send the RAW value to Supabase, which hashes it again and compares against the `nonce`
 * claim in the signed token. Sending the hash to both, or the raw value to Apple, both
 * fail the check.
 *
 * Google's native flow omits the nonce: Supabase's iOS guidance is to turn on "Skip nonce
 * check" for the Google provider, because the Google Sign-In SDK doesn't surface one.
 *
 * Cancellation is not an error. A user who backs out of the system sheet gets `null` and
 * the screen simply stays put.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';

import type { AccountProvider } from '@/store/onboarding';

/** What the backend's POST /auth/oauth expects. */
export type IdentityToken = {
  provider: AccountProvider;
  idToken: string;
  /** Raw (unhashed) nonce. Apple only. */
  nonce?: string;
};

/** Thrown when the provider is reachable but refused, or is not configured for this build. */
export class SignInError extends Error {}

const extra = Constants.expoConfig?.extra ?? {};
const GOOGLE_IOS_CLIENT_ID: string | undefined = extra.googleIosClientId || undefined;
const GOOGLE_WEB_CLIENT_ID: string | undefined = extra.googleWebClientId || undefined;

/** Apple's sheet exists on iOS 13+ only; the button is hidden everywhere else. */
export async function isAppleAvailable(): Promise<boolean> {
  if (process.env.EXPO_OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

/** Google needs client IDs baked in at build time; without them the button is disabled. */
export function isGoogleConfigured(): boolean {
  return GOOGLE_IOS_CLIENT_ID != null;
}

function isCancellation(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  // expo-apple-authentication | @react-native-google-signin
  return code === 'ERR_REQUEST_CANCELED' || code === 'SIGN_IN_CANCELLED' || code === '-5';
}

async function signInWithApple(): Promise<IdentityToken | null> {
  try {
    // Inside the try: a digest failure is an Apple sign-in failure like any other, and
    // outside it would escape as a bare Error that the caller cannot label.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      // Apple embeds this string in the token's `nonce` claim.
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      throw new SignInError('Apple did not return an identity token.');
    }
    return { provider: 'apple', idToken: credential.identityToken, nonce: rawNonce };
  } catch (err) {
    if (isCancellation(err)) return null;
    throw err instanceof SignInError ? err : new SignInError('Apple sign-in failed.');
  }
}

async function signInWithGoogle(): Promise<IdentityToken | null> {
  if (!isGoogleConfigured()) {
    throw new SignInError('Google sign-in is not configured for this build.');
  }

  // Imported on demand: the module is only present once the config plugin has run, and a
  // build without Google client IDs should not fail at import time.
  const { GoogleSignin, isSuccessResponse } =
    await import('@react-native-google-signin/google-signin');

  GoogleSignin.configure({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    // Supabase matches the token's `aud` against the client IDs registered on the
    // provider, and expects the web client ID first in that list.
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null; // user dismissed the sheet

    const idToken = response.data.idToken;
    if (!idToken) throw new SignInError('Google did not return an identity token.');
    return { provider: 'google', idToken };
  } catch (err) {
    if (isCancellation(err)) return null;
    throw err instanceof SignInError ? err : new SignInError('Google sign-in failed.');
  }
}

/** Returns `null` when the user cancels; throws `SignInError` when the provider refuses. */
export function getIdentityToken(provider: AccountProvider): Promise<IdentityToken | null> {
  return provider === 'apple' ? signInWithApple() : signInWithGoogle();
}
