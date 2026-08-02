import { useEffect, useState } from "react";

// Preview credentials — ADMIN-PREVIEW code has allModulesUnlocked=true, which means
// the server accepts any deviceId (stores "reviewer-any-device" internally).
// Bypassing the bind-preview API call so this works in all environments without
// needing an in-memory admin token.
const PREVIEW_CODE     = "ADMIN-PREVIEW";
const PREVIEW_DEVICE   = "admin-preview-device-001";
const PREVIEW_NAME     = "Admin";
const PREVIEW_EMAIL    = "admin@chainsawcourses.com";
const PREVIEW_USER_ID  = "33";

export default function AdminPreviewLogin() {
  const [status, setStatus] = useState("Setting up preview...");

  useEffect(() => {
    // Write preview session directly to localStorage — no API call needed.
    localStorage.setItem("activationCode", PREVIEW_CODE);
    localStorage.setItem("deviceId",       PREVIEW_DEVICE);
    localStorage.setItem("fullName",        PREVIEW_NAME);
    localStorage.setItem("email",           PREVIEW_EMAIL);
    localStorage.setItem("userId",          PREVIEW_USER_ID);

    // Also set cookies so the UserContext cookie-fallback layer is consistent
    const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
    const cookieOpts = `; expires=${expires}; path=/; SameSite=Lax`;
    document.cookie = `activationCode=${encodeURIComponent(PREVIEW_CODE)}${cookieOpts}`;
    document.cookie = `deviceId=${encodeURIComponent(PREVIEW_DEVICE)}${cookieOpts}`;
    document.cookie = `fullName=${encodeURIComponent(PREVIEW_NAME)}${cookieOpts}`;
    document.cookie = `email=${encodeURIComponent(PREVIEW_EMAIL)}${cookieOpts}`;
    document.cookie = `userId=${encodeURIComponent(PREVIEW_USER_ID)}${cookieOpts}`;

    setStatus("Launching preview...");
    window.location.href = `${import.meta.env.BASE_URL}training`;
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest text-center max-w-xs">
        {status}
      </p>
    </div>
  );
}
