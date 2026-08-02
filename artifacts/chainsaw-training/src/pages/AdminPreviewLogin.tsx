import { useEffect, useState } from "react";

const PREVIEW_CODE   = "ADMIN-PREVIEW";
const PREVIEW_DEVICE = "admin-preview-device-001"; // device-agnostic code — server ignores this value
const PREVIEW_NAME   = "Admin Preview";
const PREVIEW_EMAIL  = "admin@chainsawcourses.com";

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
        // Step 1: activate / look up the preview user to get the correct userId
        // for this environment (dev vs production may have different user IDs).
        setStatus("Authenticating preview user...");
        const activateRes = await fetch("/api/auth/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code:     PREVIEW_CODE,
            deviceId: PREVIEW_DEVICE,
            fullName: PREVIEW_NAME,
            email:    PREVIEW_EMAIL,
          }),
        });

        if (!activateRes.ok) {
          const err = await activateRes.json().catch(() => ({}));
          throw new Error(`activate failed (${activateRes.status}): ${err?.error ?? "unknown"}`);
        }

        const { userId, fullName, email, waiverRequired } = await activateRes.json() as {
          userId: number;
          fullName: string;
          email: string;
          waiverRequired: boolean;
        };

        // Store credentials immediately so the waiver call below is authenticated.
        storeCredentials(PREVIEW_CODE, PREVIEW_DEVICE, fullName, email, userId);

        // Step 2: auto-sign the waiver if needed (preview shouldn't block on it).
        if (waiverRequired) {
          setStatus("Auto-signing preview waiver...");
          await fetch("/api/waiver", {
            method: "POST",
            headers: {
              "Content-Type":  "application/json",
              activationcode:  PREVIEW_CODE,
              deviceid:        PREVIEW_DEVICE,
              userid:          String(userId),
            },
            body: JSON.stringify({
              signatureData:     "ADMIN-PREVIEW-AUTO",
              agreedToTerms:     true,
              clausesSnapshot:   null,
            }),
          });
          // Waiver failure is non-fatal — the waiver page will handle it if necessary.
        }

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
