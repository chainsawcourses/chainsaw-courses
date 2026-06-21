import React, { createContext, useContext, useEffect, useState } from "react";

interface AdminContextType {
  adminToken: string | null;
  isReady: boolean;
  setToken: (token: string) => void;
  clearToken: () => void;
}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setAdminToken(localStorage.getItem("adminToken"));
    setIsReady(true);
  }, []);

  const setToken = (token: string) => {
    localStorage.setItem("adminToken", token);
    setAdminToken(token);
  };

  const clearToken = () => {
    localStorage.removeItem("adminToken");
    setAdminToken(null);
  };

  return (
    <AdminContext.Provider value={{ adminToken, isReady, setToken, clearToken }}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdminSession = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdminSession must be used within AdminProvider");
  return ctx;
};
