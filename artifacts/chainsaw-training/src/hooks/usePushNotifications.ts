import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { getLearnerAuthHeaders } from "../lib/sessionStorage";

const BASE = import.meta.env.BASE_URL as string;
const SW_PATH = `${BASE}sw.js`;
const SW_SCOPE = BASE;

async function getVapidPublicKey(): Promise<string> {
  const res = await fetch(`${BASE}api/push/vapid-public-key`);
  if (!res.ok) throw new Error("Failed to fetch VAPID key");
  const data = await res.json() as { publicKey: string };
  return data.publicKey;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function sendSubscriptionToServer(sub: PushSubscription, method: "POST" | "DELETE") {
  const json = sub.toJSON();
  const authHeaders = await getLearnerAuthHeaders();
  if (!authHeaders) throw new Error("Learner session is unavailable");
  const headers = new Headers(authHeaders);
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${BASE}api/push/subscribe`, {
    method,
    headers,
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
    }),
  });
  if (!res.ok) throw new Error(`Push subscription request failed (${res.status})`);
}

export type NotifState = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";

export function usePushNotifications() {
  const [state, setState] = useState<NotifState>("loading");

  useEffect(() => {
    if (
      Capacitor.isNativePlatform() ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "subscribed" : "unsubscribed");
    }).catch(() => setState("unsubscribed"));
  }, []);

  const subscribe = useCallback(async () => {
    if (Capacitor.isNativePlatform() || !("serviceWorker" in navigator)) return;
    setState("loading");
    try {
      // Reuse the SW already registered in main.tsx; only register if somehow missing
      let reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      if (!reg) {
        reg = await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE });
      }
      await navigator.serviceWorker.ready;
      const publicKey = await getVapidPublicKey();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
      });
      await sendSubscriptionToServer(sub, "POST");
      setState("subscribed");
    } catch (err) {
      console.warn("Push subscribe failed", err);
      setState(Notification.permission === "denied" ? "denied" : "unsubscribed");
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (Capacitor.isNativePlatform() || !("serviceWorker" in navigator)) return;
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sendSubscriptionToServer(sub, "DELETE");
        await sub.unsubscribe();
      }
      setState("unsubscribed");
    } catch (err) {
      console.warn("Push unsubscribe failed", err);
      setState("unsubscribed");
    }
  }, []);

  return { state, subscribe, unsubscribe };
}
