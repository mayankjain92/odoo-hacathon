"use client";

import { useEffect, useState } from "react";

export function MswProvider({ children }: { children: React.ReactNode }) {
  const [mswReady, setMswReady] = useState(false);

  useEffect(() => {
    async function initMsw() {
      if (typeof window !== "undefined") {
        if (process.env.NEXT_PUBLIC_API_MOCKING === "enabled") {
          const { worker } = await import("./browser");
          await worker.start({
            onUnhandledRequest: "bypass",
          });
        }
      }
      setMswReady(true);
    }
    initMsw();
  }, []);

  if (!mswReady && process.env.NEXT_PUBLIC_API_MOCKING === "enabled") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1419] text-[#2dd4bf] font-[family-name:var(--font-display)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2dd4bf] border-t-transparent"></div>
          <span className="text-sm tracking-wide text-neutral-400">Initializing mock environment...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
