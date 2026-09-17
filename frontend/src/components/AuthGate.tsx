"use client";

import { type User, onAuthStateChanged } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { authEnabled, getFirebaseAuth } from "@/lib/firebase";

// Keeps every page behind sign-in when Firebase is configured; a no-op in dev mode.
export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const onLoginPage = pathname.startsWith("/login");
  // undefined: session still loading; null: signed out.
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    if (!authEnabled || user === undefined) return;
    if (user === null && !onLoginPage) router.replace("/login/");
    if (user !== null && onLoginPage) router.replace("/");
  }, [user, onLoginPage, router]);

  if (!authEnabled) return children;
  if (onLoginPage) return user ? null : children;
  return user ? children : null;
}
