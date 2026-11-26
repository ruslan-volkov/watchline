import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  clearArrConfig,
  loadNasConfig,
  saveArrConfig,
  type ArrConfig,
  type ArrService,
  type NasConfig,
} from './config';

// Read once at the root so every screen sees the same config. Deliberately not
// React Query: its cache is persisted in clear, and this holds the API keys.
interface NasConfigValue {
  config: NasConfig;
  /** False until the stored config has been read. */
  loaded: boolean;
  save: (service: ArrService, config: ArrConfig) => Promise<void>;
  clear: (service: ArrService) => Promise<void>;
}

const NasConfigContext = createContext<NasConfigValue>({
  config: {},
  loaded: false,
  save: async () => {},
  clear: async () => {},
});

export function NasConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<NasConfig>({});
  const [loaded, setLoaded] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    loadNasConfig()
      .then(setConfig)
      // Keychain unavailable: behave as "not configured" rather than crash.
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const save = useCallback(
    async (service: ArrService, next: ArrConfig) => {
      await saveArrConfig(service, next);
      setConfig((c) => ({ ...c, [service]: next }));
      // States read from the old address no longer apply.
      qc.removeQueries({ queryKey: ['nas'] });
    },
    [qc],
  );

  const clear = useCallback(
    async (service: ArrService) => {
      await clearArrConfig(service);
      setConfig((c) => {
        const { [service]: _removed, ...rest } = c;
        return rest;
      });
      qc.removeQueries({ queryKey: ['nas'] });
    },
    [qc],
  );

  const value = useMemo(() => ({ config, loaded, save, clear }), [config, loaded, save, clear]);
  return <NasConfigContext.Provider value={value}>{children}</NasConfigContext.Provider>;
}

export function useNasConfig(): NasConfigValue {
  return useContext(NasConfigContext);
}
