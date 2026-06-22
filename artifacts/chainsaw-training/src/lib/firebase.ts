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
    { id: 1, vimeoId: "1203270470/92eba2993e", title: "Introduction to Chainsaw Safety", description: "Overview of UK regulations, legal requirements, and the importance of proper training before operating a chainsaw." },
    { id: 2, vimeoId: "76979871", title: "Personal Protective Equipment", description: "Full breakdown of mandatory PPE for chainsaw operators including standards, inspection procedures and correct fitting." },
    { id: 3, vimeoId: "76979871", title: "Chainsaw Anatomy & Maintenance", description: "Understanding the components of your chainsaw, daily checks, chain tensioning, sharpening and safe storage." },
    { id: 4, vimeoId: "76979871", title: "Kickback & Hazard Awareness", description: "Identifying and preventing kickback, reactive forces, and common on-site hazards that lead to serious injury." },
    { id: 5, vimeoId: "76979871", title: "Safe Felling Techniques", description: "Step-by-step felling procedure including site assessment, escape routes, exclusion zones and hinge wood." },
    { id: 6, vimeoId: "76979871", title: "Limbing & Cross-Cutting", description: "Safe working methods for removing branches and cross-cutting felled timber, including supported and unsupported cuts." },
    { id: 7, vimeoId: "76979871", title: "Emergency Procedures & First Aid", description: "Chainsaw injury first aid, emergency stop procedures, reporting requirements and lone working protocols." },
  ]),
};
