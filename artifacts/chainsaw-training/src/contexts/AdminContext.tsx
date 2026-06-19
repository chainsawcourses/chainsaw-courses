import React, { createContext, useContext, useEffect, useState } from "react";

interface AdminContextType {
  adminToken: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [adminToken, setAdminToken] = useState<string | null>(null);

  useEffect(() => {
    setAdminToken(localStorage.getItem("adminToken"));
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
    <AdminContext.Provider value={{ adminToken, setToken, clearToken }}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdminSession = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdminSession must be used within AdminProvider");
  return ctx;
};
