import { useEffect } from "react";
import { useLocation } from "wouter";

const PREVIEW_CODE = "ADMIN-PREVIEW";
const PREVIEW_DEVICE = "admin-preview-device-001";
const PREVIEW_NAME = "Admin Preview";
const PREVIEW_EMAIL = "admin@chainsawcourses.com";

export default function AdminPreviewLogin() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Resolve the user ID for the preview account then store session
    const setup = async () => {
      try {
        const res = await fetch("/api/auth/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activationCode: PREVIEW_CODE,
            deviceId: PREVIEW_DEVICE,
            fullName: PREVIEW_NAME,
            email: PREVIEW_EMAIL,
          }),
        });
        const data = await res.json();
        if (data.userId) {
          localStorage.setItem("activationCode", PREVIEW_CODE);
          localStorage.setItem("deviceId", PREVIEW_DEVICE);
          localStorage.setItem("fullName", PREVIEW_NAME);
          localStorage.setItem("email", PREVIEW_EMAIL);
          localStorage.setItem("userId", String(data.userId));
        }
      } catch {
        // Fallback: set localStorage directly
        localStorage.setItem("activationCode", PREVIEW_CODE);
        localStorage.setItem("deviceId", PREVIEW_DEVICE);
        localStorage.setItem("fullName", PREVIEW_NAME);
        localStorage.setItem("email", PREVIEW_EMAIL);
      }
      setLocation("/training");
    };
    setup();
  }, [setLocation]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
      <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">Loading preview...</p>
    </div>
  );
}
