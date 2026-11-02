import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { useUserSession } from "../contexts/UserContext";

type ProtectedAssessmentImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  adminToken?: string;
};

export function ProtectedAssessmentImage({ src, adminToken, ...props }: ProtectedAssessmentImageProps) {
  const { activationCode, deviceId, userId } = useUserSession();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let nextObjectUrl: string | null = null;
    const url = new URL(src, window.location.origin);
    const isProtectedSameOriginUrl =
      url.origin === window.location.origin &&
      /^\/api\/assessment-images\/(?:(?:bundled|uploads)\/[a-zA-Z0-9._-]+|objects\/assessment-media\/images\/[a-f0-9-]+)$/.test(url.pathname);
    if (!isProtectedSameOriginUrl) {
      setObjectUrl(null);
      return () => controller.abort();
    }
    const headers: Record<string, string> = adminToken
      ? { admintoken: adminToken }
      : {
          activationcode: activationCode ?? "",
          deviceid: deviceId ?? "",
          ...(userId ? { userid: String(userId) } : {}),
        };

    setObjectUrl(null);
    fetch(url.pathname, { headers, cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Assessment image request failed: ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
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
  return <img src={objectUrl} {...props} />;
}