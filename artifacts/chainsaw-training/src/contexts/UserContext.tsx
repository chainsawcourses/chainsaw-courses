import React, { createContext, useContext, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

interface UserContextType {
  activationCode: string | null;
  deviceId: string | null;
  fullName: string | null;
  email: string | null;
  setSession: (data: { activationCode: string; fullName: string; email: string }) => void;
  clearSession: () => void;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // Generate deviceId if missing
    let id = localStorage.getItem("deviceId");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("deviceId", id);
    }
    setDeviceId(id);

    setActivationCode(localStorage.getItem("activationCode"));
    setFullName(localStorage.getItem("fullName"));
    setEmail(localStorage.getItem("email"));
  }, []);

  const setSession = (data: { activationCode: string; fullName: string; email: string }) => {
    localStorage.setItem("activationCode", data.activationCode);
    localStorage.setItem("fullName", data.fullName);
    localStorage.setItem("email", data.email);
    setActivationCode(data.activationCode);
    setFullName(data.fullName);
    setEmail(data.email);
  };

  const clearSession = () => {
    localStorage.removeItem("activationCode");
    localStorage.removeItem("fullName");
    localStorage.removeItem("email");
    setActivationCode(null);
    setFullName(null);
    setEmail(null);
  };

  return (
    <UserContext.Provider value={{ activationCode, deviceId, fullName, email, setSession, clearSession }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUserSession = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserSession must be used within UserProvider");
  return ctx;
};
