import { useEffect, useState, type AudioHTMLAttributes } from "react";
import { useUserSession } from "../contexts/UserContext";

type Props = Omit<AudioHTMLAttributes<HTMLAudioElement>, "src"> & {
  src: string;
  adminToken?: string;
};

export function ProtectedAssessmentAudio({ src, adminToken, ...props }: Props) {
  const { activationCode, deviceId, userId } = useUserSession();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let nextObjectUrl: string | null = null;
    const url = new URL(src, window.location.origin);
    const protectedUrl = url.origin === window.location.origin &&
      /^\/api\/assessment-audio\/(?:uploads\/[a-zA-Z0-9._-]+|objects\/assessment-media\/audio\/[a-f0-9-]+)$/.test(url.pathname);
    if (!protectedUrl) { setObjectUrl(null); return () => controller.abort(); }
    const headers: Record<string, string> = adminToken
      ? { admintoken: adminToken }
      : {
          activationcode: activationCode ?? "",
          deviceid: deviceId ?? "",
          ...(userId ? { userid: String(userId) } : {}),
        };
    setObjectUrl(null);
    fetch(url.pathname, { headers, cache: "no-store", signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Assessment audio request failed: ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        if (controller.signal.aborted) return;
        nextObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(nextObjectUrl);
      })
      .catch(() => {});
    return () => {
      controller.abort();
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
    };
  }, [activationCode, adminToken, deviceId, src, userId]);

  if (!objectUrl) return null;
  return <audio src={objectUrl} {...props} />;
}