import { initializeApp } from "firebase/app";
import { getRemoteConfig } from "firebase/remote-config";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const remoteConfig = getRemoteConfig(app);

remoteConfig.settings.minimumFetchIntervalMillis = 1000 * 60 * 60;
remoteConfig.settings.fetchTimeoutMillis = 10000;

remoteConfig.defaultConfig = {
  modules_config: JSON.stringify([
    { id: 1, vimeoId: "", title: "Equipment List", description: "" },
    { id: 2, vimeoId: "", title: "PPE & First Aid", description: "" },
    { id: 3, vimeoId: "", title: "5 Steps To Risk Assessment", description: "" },
    { id: 4, vimeoId: "", title: "Hazards & Risks", description: "" },
    { id: 5, vimeoId: "", title: "Emergency Planning Information", description: "" },
    { id: 6, vimeoId: "", title: "Law & Legislation", description: "" },
    { id: 7, vimeoId: "", title: "Chainsaw Safety Features", description: "" },
    { id: 8, vimeoId: "", title: "Air Filter", description: "" },
    { id: 9, vimeoId: "", title: "Spark Plug", description: "" },
    { id: 10, vimeoId: "", title: "Cooling System", description: "" },
    { id: 11, vimeoId: "", title: "Exhaust", description: "" },
    { id: 12, vimeoId: "", title: "Fuel & Oil Filters", description: "" },
    { id: 13, vimeoId: "", title: "Recoil Starter", description: "" },
    { id: 14, vimeoId: "", title: "Clutch Assembly", description: "" },
    { id: 15, vimeoId: "", title: "Sprocket", description: "" },
    { id: 16, vimeoId: "", title: "Chain Brake", description: "" },
    { id: 17, vimeoId: "", title: "Guidebar", description: "" },
    { id: 18, vimeoId: "", title: "Chain Basics", description: "" },
    { id: 19, vimeoId: "", title: "Chain Tension", description: "" },
    { id: 20, vimeoId: "", title: "Identifying The Chain", description: "" },
    { id: 21, vimeoId: "", title: "Replacing The Chain", description: "" },
    { id: 22, vimeoId: "", title: "Chain Sharpening", description: "" },
    { id: 23, vimeoId: "", title: "Stacking", description: "" },
    { id: 24, vimeoId: "", title: "Work Positioning", description: "" },
    { id: 25, vimeoId: "", title: "Pre-Start Checks", description: "" },
    { id: 26, vimeoId: "", title: "Starting The Chainsaw", description: "" },
    { id: 27, vimeoId: "", title: "Pre-Use Checks", description: "" },
    { id: 28, vimeoId: "", title: "Cutting Basics", description: "" },
    { id: 29, vimeoId: "", title: "Tension & Compression", description: "" },
    { id: 30, vimeoId: "", title: "Releasing A Trapped Chainsaw", description: "" },
    { id: 31, vimeoId: "", title: "Bore Cutting", description: "" },
    { id: 32, vimeoId: "", title: "Oversized & Tensioned Timber", description: "" },
  ]),
};
