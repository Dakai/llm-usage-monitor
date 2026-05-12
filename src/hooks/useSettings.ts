import { useState, useCallback, useEffect, useRef } from "react";
import { AppSettings } from "../types";
import { loadSettings, saveSettings as persistSettings } from "../storage/settings";

interface UseSettingsReturn {
  settings: AppSettings | null;
  isLoading: boolean;
  saveSettings: (s: AppSettings) => Promise<void>;
  reload: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMounted = useRef(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const s = await loadSettings();
      if (isMounted.current) {
        setSettings(s);
      }
    } catch {
      // keep current settings
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const save = useCallback(async (newSettings: AppSettings) => {
    await persistSettings(newSettings);
    if (isMounted.current) {
      setSettings(newSettings);
    }
  }, []);

  useEffect(() => {
    reload();
    return () => {
      isMounted.current = false;
    };
  }, [reload]);

  return { settings, isLoading, saveSettings: save, reload };
}
