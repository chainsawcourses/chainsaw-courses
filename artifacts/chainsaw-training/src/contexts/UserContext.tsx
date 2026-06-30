import React, { createContext, useContext, useState } from "react";
import { v4 as uuidv4 } from "uuid";

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
    () => localStorage.getItem("activationCode")
  );
  const [deviceId, setDeviceId] = useState<string | null>(() => {
    let id = localStorage.getItem("deviceId");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("deviceId", id);
    }
    return id;
  });
  const [fullName, setFullName] = useState<string | null>(
    () => localStorage.getItem("fullName")
  );
  const [email, setEmail] = useState<string | null>(
    () => localStorage.getItem("email")
  );
  const [userId, setUserId] = useState<number | null>(() => {
    const stored = localStorage.getItem("userId");
    return stored ? Number(stored) : null;
  });

  const setSession = (data: { activationCode: string; fullName: string; email: string; userId: number }) => {
    localStorage.setItem("activationCode", data.activationCode);
    localStorage.setItem("fullName", data.fullName);
    localStorage.setItem("email", data.email);
    localStorage.setItem("userId", String(data.userId));
    setActivationCode(data.activationCode);
    setFullName(data.fullName);
    setEmail(data.email);
    setUserId(data.userId);
  };

  const clearSession = () => {
    localStorage.removeItem("activationCode");
    localStorage.removeItem("fullName");
    localStorage.removeItem("email");
    localStorage.removeItem("userId");
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
