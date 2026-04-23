import { useEffect } from "react";
import { flushOfflineQueue } from "@/lib/offlineQueue";

export const OfflineSync = () => {
  useEffect(() => {
    const run = () => {
      flushOfflineQueue().catch(() => undefined);
    };

    run();
    window.addEventListener("online", run);
    return () => window.removeEventListener("online", run);
  }, []);

  return null;
};

