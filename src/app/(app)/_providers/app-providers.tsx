"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState, type ReactNode } from "react";

/**
 * Client providers for the (app) shell (spec §5): TanStack Query for server state with
 * optimistic mutations (ADR-042) and nuqs for view/filter/sort state in the URL.
 *
 * The QueryClient is created per mount (never module-level) so two browser tabs and two tests
 * never share a cache.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <NuqsAdapter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NuqsAdapter>
  );
}
