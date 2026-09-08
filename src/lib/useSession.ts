"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "./supabase";

/**
 * Текущий пользователь.
 *
 * `loading` нужен, чтобы шапка не мигала «Войти» у того, кто уже вошёл:
 * сессия читается из хранилища браузера не мгновенно.
 */
export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUser(data.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

/** Как показать вошедшего: почтой, если есть, иначе телефоном. */
export function displayWho(user: User): string {
  return user.email ?? user.phone ?? "—";
}
