import { useEffect, useState } from "react";
import { fetchAndActivate, getString } from "firebase/remote-config";
import { remoteConfig } from "../lib/firebase";

export interface ModuleRemoteConfig {
  id: number;
  vimeoId: string;
  title: string;
  description: string;
}

interface RemoteConfigState {
  modulesConfig: ModuleRemoteConfig[];
  disclaimerText: string;
  isLoading: boolean;
  error: string | null;
}

export function useRemoteConfig(): RemoteConfigState {
  const [state, setState] = useState<RemoteConfigState>({
    modulesConfig: [],
    disclaimerText: "",
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const extract = () => {
      const raw = getString(remoteConfig, "modules_config");
      const disclaimer = getString(remoteConfig, "disclaimer & copyright notice");
      try {
        const parsed: ModuleRemoteConfig[] = JSON.parse(raw);
        setState({ modulesConfig: parsed, disclaimerText: disclaimer, isLoading: false, error: null });
      } catch {
        setState({ modulesConfig: [], disclaimerText: disclaimer, isLoading: false, error: "Failed to parse remote config" });
      }
    };

    fetchAndActivate(remoteConfig)
      .then(extract)
      .catch(extract);
  }, []);

  return state;
}
