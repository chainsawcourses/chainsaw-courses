import { useState, useEffect, useCallback } from "react";

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
  await fetch(`${BASE}api/push/subscribe`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
    }),
  });
}

export type NotifState = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";

export function usePushNotifications() {
  const [state, setState] = useState<NotifState>("loading");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
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
    if (!("serviceWorker" in navigator)) return;
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE });
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
    if (!("serviceWorker" in navigator)) return;
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
