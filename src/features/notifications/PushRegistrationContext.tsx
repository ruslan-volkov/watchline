import { createContext, useContext } from 'react';

import type { PushRegistrationResult } from './attempt';
import { usePushRegistration } from './usePushRegistration';

// Registration runs once, at the root; screens read the outcome from here
// rather than each mounting their own attempt.
const PushStatusContext = createContext<PushRegistrationResult | null>(null);

export function PushRegistrationProvider({ children }: { children: React.ReactNode }) {
  const status = usePushRegistration();
  return <PushStatusContext.Provider value={status}>{children}</PushStatusContext.Provider>;
}

/** The last registration outcome, or `null` while the first attempt is pending. */
export function usePushStatus(): PushRegistrationResult | null {
  return useContext(PushStatusContext);
}
