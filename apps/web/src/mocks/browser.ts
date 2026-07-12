import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

// Start in a client component: if (process.env.NEXT_PUBLIC_API_MOCKING === "enabled") await worker.start()
// One-time setup: pnpm --filter @assetflow/web exec msw init public --save
export const worker = setupWorker(...handlers);
