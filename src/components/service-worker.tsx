"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (MVP #29, ADR-055) in production only — a service worker and dev
 * HMR are a bad mix, and the offline shell is a production concern. Failures are ignored: the
 * app works online with or without one.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration is best-effort */
    });
  }, []);
  return null;
}
