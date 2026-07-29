/** True when the app is running as the public demo (VITE_DEMO_MODE=true). */
export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === "true";

/** Synthetic credentials used by the demo — matched by the API server when DEMO_MODE=true. */
export const DEMO_ACTIVATION_CODE = "DEMO-PREVIEW";
export const DEMO_DEVICE_ID = "demo-device-0000";
