"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (MVP #29, ADR-055) in production only — a service worker and dev
 * HMR are a bad mix, and the offline shell is a production concern. Failures are ignored: the app
 * works online with or without one.
 *
 * In development it also **unregisters** any worker left behind by an earlier production run on the
 * same origin and clears its caches. Without that, a previously installed worker keeps serving the
 * production chunk names to the dev server, which hydrates the stale bundle against fresh HTML and
 * throws a hydration mismatch (the classic "old nav, new page" symptom).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void (async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
      })().catch(() => {
        /* cleanup is best-effort */
      });
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration is best-effort */
    });
  }, []);
  return null;
}
