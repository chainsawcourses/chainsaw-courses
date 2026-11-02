export type AnalyticsData = Record<string, string | number | boolean>;

export type ManualDeliveryEvent =
  | "manual_page_load_failed"
  | "manual_page_retry_attempted"
  | "manual_page_retry_succeeded";

export type ManualDeliveryData = {
  surface: "reader" | "zoom";
  layout: "single_page" | "spread";
  attempt?: "initial" | "retry";
  failure_type?: "request" | "image_decode";
};

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;

  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never affect the user-facing flow.
  }
}

export function trackManualDeliveryEvent(
  name: ManualDeliveryEvent,
  data: ManualDeliveryData,
): void {
  const safeData: AnalyticsData = {
    surface: data.surface,
    layout: data.layout,
  };

  if (data.attempt !== undefined) safeData.attempt = data.attempt;
  if (data.failure_type !== undefined) safeData.failure_type = data.failure_type;

  trackEvent(name, safeData);
}
