import { useEffect, useState } from "react";

export default function AdminPreviewLogin() {
  const [status, setStatus] = useState("Setting up preview...");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const setup = async () => {
      try {
        const deviceId   = localStorage.getItem("deviceId")   || "admin-preview-device-001";
        const adminToken = localStorage.getItem("adminToken") || "";

        const res = await fetch("/api/admin/bind-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json", admintoken: adminToken },
          body: JSON.stringify({ deviceId }),
        });

        // Session expired — bounce to admin login then come back here
        if (res.status === 401) {
          setStatus("Admin session expired. Redirecting to login...");
          setTimeout(() => {
            window.location.href = `${import.meta.env.BASE_URL}admin?redirect=admin-preview`;
          }, 1200);
          return;
        }

        if (!res.ok) throw new Error(`bind failed (${res.status})`);

        const data = await res.json();

        localStorage.setItem("activationCode", data.activationCode);
        localStorage.setItem("deviceId",       data.deviceId);
        localStorage.setItem("fullName",        data.fullName);
        localStorage.setItem("email",           data.email);
        localStorage.setItem("userId",          String(data.userId));

        setStatus("Launching preview...");
        window.location.href = `${import.meta.env.BASE_URL}training`;
      } catch (err) {
        console.error(err);
        setFailed(true);
        setStatus("Something went wrong setting up the preview.");
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
