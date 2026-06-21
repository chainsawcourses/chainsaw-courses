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
  isLoading: boolean;
  error: string | null;
}

export function useRemoteConfig(): RemoteConfigState {
  const [state, setState] = useState<RemoteConfigState>({
    modulesConfig: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    fetchAndActivate(remoteConfig)
      .then(() => {
        const raw = getString(remoteConfig, "modules_config");
        try {
          const parsed: ModuleRemoteConfig[] = JSON.parse(raw);
          setState({ modulesConfig: parsed, isLoading: false, error: null });
        } catch {
          setState({ modulesConfig: [], isLoading: false, error: "Failed to parse remote config" });
        }
      })
      .catch((err) => {
        const raw = getString(remoteConfig, "modules_config");
        try {
          const parsed: ModuleRemoteConfig[] = JSON.parse(raw);
          setState({ modulesConfig: parsed, isLoading: false, error: null });
        } catch {
          setState({ modulesConfig: [], isLoading: false, error: String(err) });
        }
      });
  }, []);

  return state;
}
