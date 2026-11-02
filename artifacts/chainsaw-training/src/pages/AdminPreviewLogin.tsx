import { useEffect, useState } from "react";
import { appPath } from "../lib/routing";
import { ChainsawLoader } from "@/components/ui/chainsaw-loader";
import { saveLearnerSession } from "../lib/sessionStorage";

const PREVIEW_CODE = "ADMIN-PREVIEW";

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
        window.history.replaceState({}, "", window.location.pathname);

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

        // Use the canonical learner-session path so a previously suspended
        // browser session is reactivated and stale enrolment data is cleared.
        // bind-preview signs the waiver server-side before returning.
        await saveLearnerSession(deviceId, {
          activationCode: PREVIEW_CODE,
          fullName,
          email,
          userId,
          enrollmentId: null,
        });

        setStatus("Launching preview...");
        window.location.href = appPath("training");
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
        <ChainsawLoader className="w-10 h-10 text-primary" />
      )}
      <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest text-center max-w-xs">
        {status}
      </p>
      {failed && (
        <a
          href={appPath("admin")}
          className="font-mono text-xs underline text-primary uppercase tracking-widest"
        >
          Go to Admin Login
        </a>
      )}
    </div>
  );
}
