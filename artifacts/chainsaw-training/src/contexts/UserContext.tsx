import React, { createContext, useContext, useState } from "react";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// Cookie helpers — used as a fallback when localStorage is cleared (Safari iOS
// clears localStorage after ~7 days of inactivity; cookies survive much longer)
// ---------------------------------------------------------------------------
const COOKIE_EXPIRY_DAYS = 365;

function setCookie(name: string, value: string) {
  const expires = new Date(Date.now() + COOKIE_EXPIRY_DAYS * 864e5).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const prefix = encodeURIComponent(name) + "=";
  const pair = document.cookie.split("; ").find((row) => row.startsWith(prefix));
  if (!pair) return null;
  try {
    return decodeURIComponent(pair.slice(prefix.length));
  } catch {
    return null;
  }
}

function deleteCookie(name: string) {
  document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

// Read from localStorage, falling back to cookie if localStorage entry is missing.
// If the cookie had the value but localStorage didn't, also repopulate localStorage
// so the rest of the app continues to work without cookie reads on every access.
function readPersisted(key: string): string | null {
  const fromStorage = localStorage.getItem(key);
  if (fromStorage !== null) return fromStorage;
  const fromCookie = getCookie(key);
  if (fromCookie !== null) {
    localStorage.setItem(key, fromCookie);
  }
  return fromCookie;
}

function writePersisted(key: string, value: string) {
  localStorage.setItem(key, value);
  setCookie(key, value);
}

function removePersisted(key: string) {
  localStorage.removeItem(key);
  deleteCookie(key);
}

// ---------------------------------------------------------------------------

interface UserContextType {
  activationCode: string | null;
  deviceId: string | null;
  fullName: string | null;
  email: string | null;
  userId: number | null;
  setSession: (data: { activationCode: string; fullName: string; email: string; userId: number }) => void;
  clearSession: () => void;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [activationCode, setActivationCode] = useState<string | null>(
    () => readPersisted("activationCode")
  );
  const [deviceId] = useState<string | null>(() => {
    let id = readPersisted("deviceId");
    if (!id) {
      id = uuidv4();
    }
    // Always ensure both localStorage and cookie are in sync for deviceId
    writePersisted("deviceId", id);
    return id;
  });
  const [fullName, setFullName] = useState<string | null>(
    () => readPersisted("fullName")
  );
  const [email, setEmail] = useState<string | null>(
    () => readPersisted("email")
  );
  const [userId, setUserId] = useState<number | null>(() => {
    const stored = readPersisted("userId");
    return stored ? Number(stored) : null;
  });

  const setSession = (data: { activationCode: string; fullName: string; email: string; userId: number }) => {
    writePersisted("activationCode", data.activationCode);
    writePersisted("fullName", data.fullName);
    writePersisted("email", data.email);
    writePersisted("userId", String(data.userId));
    setActivationCode(data.activationCode);
    setFullName(data.fullName);
    setEmail(data.email);
    setUserId(data.userId);
  };

  const clearSession = () => {
    removePersisted("activationCode");
    removePersisted("fullName");
    removePersisted("email");
    removePersisted("userId");
    // Keep deviceId — the device bond must survive logout so the same
    // activation code can be reused on this device without a bond conflict.
    setActivationCode(null);
    setFullName(null);
    setEmail(null);
    setUserId(null);
  };

  return (
    <UserContext.Provider value={{ activationCode, deviceId, fullName, email, userId, setSession, clearSession }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUserSession = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserSession must be used within UserProvider");
  return ctx;
};
