/**
 * webauthn.js — Biometric authentication (WebAuthn platform authenticator)
 * Used as a local convenience gate for quick unlock.
 */
import { getSetting, setSetting } from '../data/db.js';

export async function isWebAuthnSupported() {
  if (
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  ) {
    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }
  return false;
}

export async function isWebAuthnEnabled() {
  const credId = await getSetting('webauthnCredId');
  return !!credId;
}

export async function registerWebAuthn() {
  const supported = await isWebAuthnSupported();
  if (!supported) {
    throw new Error('Biometrik tidak didukung pada perangkat ini');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const createOptions = {
    publicKey: {
      challenge,
      rp: {
        name: 'Daily Journal',
        id: window.location.hostname || 'localhost',
      },
      user: {
        id: userId,
        name: 'user',
        displayName: 'Journal User',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      timeout: 60000,
    },
  };

  const credential = await navigator.credentials.create(createOptions);
  if (!credential) {
    throw new Error('Pendaftaran biometrik dibatalkan');
  }

  const rawId = Array.from(new Uint8Array(credential.rawId))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  await setSetting('webauthnCredId', rawId);
  return true;
}

export async function authenticateWebAuthn() {
  const rawIdHex = await getSetting('webauthnCredId');
  if (!rawIdHex) return false;

  const rawIdBytes = new Uint8Array(rawIdHex.length / 2);
  for (let i = 0; i < rawIdHex.length; i += 2) {
    rawIdBytes[i / 2] = parseInt(rawIdHex.substring(i, i + 2), 16);
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const getOptions = {
    publicKey: {
      challenge,
      rpId: window.location.hostname || 'localhost',
      allowCredentials: [
        {
          id: rawIdBytes,
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  };

  try {
    const assertion = await navigator.credentials.get(getOptions);
    return !!assertion;
  } catch (err) {
    console.warn('WebAuthn authentication failed or cancelled:', err);
    return false;
  }
}

export async function disableWebAuthn() {
  await setSetting('webauthnCredId', null);
}
