import { createClient } from "@supabase/supabase-js";

import { supabase } from "./supabase";

/**
 * Подтверждение продаваемого номера — необязательный шаг при размещении.
 *
 * Код уходит на САМ продаваемый номер, а не на номер продавца: значок
 * «Проверено» должен получать тот, у кого на руках SIM-карта. Это важно, когда
 * номер выставляют повторно — иначе объявление мог бы подать кто угодно.
 *
 * Работа идёт через ОТДЕЛЬНЫЙ клиент Supabase со своим хранилищем: вход по
 * второму номеру не должен выбрасывать продавца из его собственной сессии.
 * Поэтому здесь persistSession: false — сессия живёт только в памяти, ровно
 * до конца проверки.
 */
const url = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
const key = (supabase as unknown as { supabaseKey: string }).supabaseKey;

const verifier = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: "araqs-number-check",
  },
});

/** Отправить код на продаваемый номер. */
export async function sendOwnershipCode(phone: string): Promise<string | null> {
  const { error } = await verifier.auth.signInWithOtp({ phone });
  return error ? error.message : null;
}

/**
 * Проверить код и записать подтверждение в базу.
 *
 * Отметку ставит сама база по номеру из подписанного токена — с фронта её не
 * подделать. Здесь только вызов, результат — текст ошибки либо null.
 */
export async function confirmOwnership(
  phone: string,
  token: string
): Promise<string | null> {
  const { error } = await verifier.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) return error.message;

  const { error: rpcError } = await verifier.rpc("confirm_number_ownership");

  // Сессию проверяемого номера не оставляем: она нужна была только для записи.
  await verifier.auth.signOut({ scope: "local" });

  return rpcError ? rpcError.message : null;
}
