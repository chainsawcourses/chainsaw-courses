import { useEffect, useState } from "react";

const PREVIEW_CODE = "ADMIN-PREVIEW";

/** Persist credentials to both localStorage and cookies so all auth paths are covered. */
function storeCredentials(activationCode: string, deviceId: string, fullName: string, email: string, userId: number) {
  localStorage.setItem("activationCode", activationCode);
  localStorage.setItem("deviceId",       deviceId);
  localStorage.setItem("fullName",        fullName);
  localStorage.setItem("email",           email);
  localStorage.setItem("userId",          String(userId));

  const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
  const base = `; expires=${expires}; path=/; SameSite=Lax`;
  document.cookie = `activationCode=${encodeURIComponent(activationCode)}${base}`;
  document.cookie = `deviceId=${encodeURIComponent(deviceId)}${base}`;
  document.cookie = `fullName=${encodeURIComponent(fullName)}${base}`;
  document.cookie = `email=${encodeURIComponent(email)}${base}`;
  document.cookie = `userId=${encodeURIComponent(userId)}${base}`;
}

export default function AdminPreviewLogin() {
  const [status, setStatus] = useState("Setting up preview...");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const setup = async () => {
      try {
        // The admin dashboard passes its short-lived admin token in the URL.
        // Fall back to localStorage so a same-origin preview still works if the
        // browser strips the query string while opening a new tab.
        const queryToken = new URLSearchParams(window.location.search).get("token");
        const adminToken = queryToken || localStorage.getItem("adminToken");
        if (!adminToken) {
          throw new Error("Admin session missing. Return to the admin portal and try again.");
        }

        // Remove the admin token from browser history as soon as it has been
        // captured. The server still authenticates the binding request below.
        window.history.replaceState({}, "", `${import.meta.env.BASE_URL}admin-preview`);

        setStatus("Authenticating preview user...");
        const deviceId = localStorage.getItem("deviceId") || crypto.randomUUID();
        localStorage.setItem("deviceId", deviceId);

        const bindRes = await fetch("/api/admin/bind-preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            admintoken: adminToken,
          },
          body: JSON.stringify({
            deviceId,
          }),
        });

        if (!bindRes.ok) {
          const err = await bindRes.json().catch(() => ({}));
          throw new Error(`preview setup failed (${bindRes.status}): ${err?.error ?? "unknown"}`);
        }

        const { userId, fullName, email } = await bindRes.json() as {
          userId: number;
          fullName: string;
          email: string;
        };

        // bind-preview signs the waiver server-side before returning.
        storeCredentials(PREVIEW_CODE, deviceId, fullName, email, userId);

        setStatus("Launching preview...");
        window.location.href = `${import.meta.env.BASE_URL}training`;
      } catch (err) {
        console.error("AdminPreviewLogin error:", err);
        setFailed(true);
        setStatus(`Preview setup failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    setup();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
      {!failed && (
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      )}
      <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest text-center max-w-xs">
        {status}
      </p>
      {failed && (
        <a
          href={`${import.meta.env.BASE_URL}admin`}
          className="font-mono text-xs underline text-primary uppercase tracking-widest"
        >
          Go to Admin Login
        </a>
      )}
    </div>
  );
}
