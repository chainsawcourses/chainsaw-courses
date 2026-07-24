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
  // Access window
  accessExpiresAt: string | null;
  courseCompletedAt: string | null;
  accessStatus: "active" | "expired" | "unknown";
  setSession: (data: { activationCode: string; fullName: string; email: string; userId: number }) => void;
  setAccessInfo: (data: { accessExpiresAt: string | null; courseCompletedAt: string | null; accessStatus: "active" | "expired" | "unknown" }) => void;
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
  const [accessExpiresAt, setAccessExpiresAt] = useState<string | null>(null);
  const [courseCompletedAt, setCourseCompletedAt] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<"active" | "expired" | "unknown">("unknown");

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

  const setAccessInfo = (data: { accessExpiresAt: string | null; courseCompletedAt: string | null; accessStatus: "active" | "expired" | "unknown" }) => {
    setAccessExpiresAt(data.accessExpiresAt);
    setCourseCompletedAt(data.courseCompletedAt);
    setAccessStatus(data.accessStatus);
  };

  const clearSession = () => {
    removePersisted("activationCode");
    removePersisted("fullName");
    removePersisted("email");
    removePersisted("userId");
    setActivationCode(null);
    setFullName(null);
    setEmail(null);
    setUserId(null);
    setAccessExpiresAt(null);
    setCourseCompletedAt(null);
    setAccessStatus("unknown");
  };

  return (
    <UserContext.Provider value={{ activationCode, deviceId, fullName, email, userId, accessExpiresAt, courseCompletedAt, accessStatus, setSession, setAccessInfo, clearSession }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUserSession = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserSession must be used within UserProvider");
  return ctx;
};
