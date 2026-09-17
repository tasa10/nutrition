import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import {
  type Auth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Without a full web config the app runs in dev mode: no login screen, no Authorization header.
export const authEnabled = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  if (!authEnabled) return null;
  if (!auth) {
    app = getApps()[0] ?? initializeApp(config);
    auth = getAuth(app);
  }
  return auth;
}

// Waits for the persisted session to load, so the first API call after a reload is authenticated.
export async function getIdToken(): Promise<string | null> {
  const a = getFirebaseAuth();
  if (!a) return null;
  await a.authStateReady();
  return a.currentUser ? a.currentUser.getIdToken() : null;
}

export function signInWithGoogle() {
  const a = getFirebaseAuth();
  if (!a) throw new Error("auth disabled");
  return signInWithPopup(a, new GoogleAuthProvider());
}

export function signInWithEmail(email: string, password: string) {
  const a = getFirebaseAuth();
  if (!a) throw new Error("auth disabled");
  return signInWithEmailAndPassword(a, email, password);
}

export function signUpWithEmail(email: string, password: string) {
  const a = getFirebaseAuth();
  if (!a) throw new Error("auth disabled");
  return createUserWithEmailAndPassword(a, email, password);
}

// Portfolio demo account: anyone can try the app without creating an account.
export const GUEST_EMAIL = "a@a.com";
export const GUEST_PASSWORD = "111111";

// Signs in as the shared guest; creates the account the first time it is used.
export async function signInAsGuest() {
  try {
    return await signInWithEmail(GUEST_EMAIL, GUEST_PASSWORD);
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "auth/invalid-credential" || code === "auth/user-not-found") {
      return signUpWithEmail(GUEST_EMAIL, GUEST_PASSWORD);
    }
    throw e;
  }
}

export function resetPassword(email: string) {
  const a = getFirebaseAuth();
  if (!a) throw new Error("auth disabled");
  return sendPasswordResetEmail(a, email);
}

export function signOut() {
  const a = getFirebaseAuth();
  return a ? firebaseSignOut(a) : Promise.resolve();
}

// Firebase reports failures as error codes; show people something they can act on.
export function describeAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "メールアドレスまたはパスワードが違います。";
    case "auth/invalid-email":
      return "メールアドレスの形式が正しくありません。";
    case "auth/email-already-in-use":
      return "このメールアドレスはすでに登録されています。";
    case "auth/weak-password":
      return "パスワードは6文字以上にしてください。";
    case "auth/too-many-requests":
      return "試行回数が多すぎます。しばらく待ってから再度お試しください。";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "ログインがキャンセルされました。";
    case "auth/popup-blocked":
      return "ポップアップがブロックされました。ブラウザの設定を確認してください。";
    case "auth/network-request-failed":
      return "ネットワークエラーです。接続を確認してください。";
    case "auth/operation-not-allowed":
      return "このログイン方法は Firebase コンソールで有効になっていません。";
    case "auth/configuration-not-found":
      return "Firebase コンソールで Authentication がまだ有効化されていません（Authentication →「始める」→ Sign-in method で Google とメールを有効化）。";
    default:
      return e instanceof Error ? e.message : "ログインに失敗しました。";
  }
}
