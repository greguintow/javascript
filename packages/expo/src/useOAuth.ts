import { useSignIn, useSignUp } from '@clerk/clerk-react';
import type { OAuthStrategy } from '@clerk/types';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

export type UseOAuthFlowParams = {
  strategy: OAuthStrategy;
  redirectUrl?: string;
};

export function useOAuth(params: UseOAuthFlowParams) {
  const { strategy, redirectUrl } = params || {};
  if (!strategy) {
    throw new Error('Missing oauth strategy');
  }

  const { signIn, setActive, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, isLoaded: isSignUpLoaded } = useSignUp();

  async function startOAuthFlow() {
    if (!isSignInLoaded || !isSignUpLoaded) {
      return {
        createdSessionId: null,
        signIn,
        signUp,
        setActive,
      };
    }

    // Create a redirect url for the current platform and environment.
    //
    // This redirect URL needs to be whitelisted for your Clerk production instance via
    // https://clerk.dev/docs/reference/backend-api/tag/Redirect-URLs#operation/CreateRedirectURL
    //
    // For more information go to:
    // https://docs.expo.dev/versions/latest/sdk/auth-session/#authsessionmakeredirecturi
    const oauthRedirectUrl =
      redirectUrl ||
      AuthSession.makeRedirectUri({
        path: '/oauth-native-callback',
      });

    await signIn.create({ strategy, redirectUrl: oauthRedirectUrl });

    const { externalVerificationRedirectURL } = signIn.firstFactorVerification;

    const result = await WebBrowser.openAuthSessionAsync(externalVerificationRedirectURL!.toString(), oauthRedirectUrl);

    // @ts-expect-error
    const { type, url } = result || {};

    // TODO: Check all the possible AuthSession results
    // https://docs.expo.dev/versions/latest/sdk/auth-session/#returns-7
    if (type !== 'success') {
      throw new Error('Something went wrong during the OAuth flow. Try again.');
    }

    const params = new URL(url).searchParams;

    const rotatingTokenNonce = params.get('rotating_token_nonce') || '';
    await signIn.reload({ rotatingTokenNonce });

    const { status, firstFactorVerification } = signIn;

    let createdSessionId = '';

    if (status === 'complete') {
      createdSessionId = signIn.createdSessionId!;
    } else if (firstFactorVerification.status === 'transferable') {
      await signUp.create({
        transfer: true,
      });
      createdSessionId = signUp.createdSessionId || '';
    }

    return { createdSessionId, signIn, signUp, setActive };
  }

  return {
    startOAuthFlow,
  };
}
