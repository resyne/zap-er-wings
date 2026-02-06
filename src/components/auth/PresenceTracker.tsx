import { useUserPresence } from "@/hooks/useUserPresence";

// This component activates user presence tracking when mounted
export function PresenceTracker() {
  useUserPresence();
  return null;
}
