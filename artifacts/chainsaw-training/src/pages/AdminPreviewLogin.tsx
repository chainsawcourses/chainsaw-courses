import { useEffect, useState } from "react";

export default function AdminPreviewLogin() {
  const [status, setStatus] = useState("Loading preview...");

  useEffect(() => {
    const setup = async () => {
      try {
        // Use the admin's existing deviceId so the bond works on their device
        const deviceId = localStorage.getItem("deviceId") || "admin-preview-device-001";
        const adminToken = localStorage.getItem("adminToken") || "";

        setStatus("Setting up preview account...");

        const res = await fetch("/api/admin/bind-preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            admintoken: adminToken,
          },
          body: JSON.stringify({ deviceId }),
        });

        if (!res.ok) throw new Error("bind failed");

        const data = await res.json();

        // Write all session keys so UserContext picks them up on hard reload
        localStorage.setItem("activationCode", data.activationCode);
        localStorage.setItem("deviceId", data.deviceId);
        localStorage.setItem("fullName", data.fullName);
        localStorage.setItem("email", data.email);
        localStorage.setItem("userId", String(data.userId));

        setStatus("Launching...");

        // Hard reload so UserContext re-initialises from the new localStorage values
        window.location.href = `${import.meta.env.BASE_URL}training`;
      } catch (err) {
        setStatus("Error setting up preview. Make sure you are logged into the admin panel first.");
        console.error(err);
      }
    };
    setup();
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
