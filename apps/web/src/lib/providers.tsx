"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { MswProvider } from "@/mocks/msw-provider";

import { apiFetch } from "@/lib/api";
import { ThemeProvider } from "./theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
            queryFn: async ({ queryKey }) => {
              if (queryKey[0] === "auth-user") {
                return apiFetch("/auth/me");
              }
              throw new Error(`No queryFn defined for queryKey: ${JSON.stringify(queryKey)}`);
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <MswProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </MswProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

