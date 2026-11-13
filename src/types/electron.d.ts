import type { JobuhanBridge } from "../shared/bridge.ts";

declare global {
  interface Window {
    jobuhan: JobuhanBridge;
  }
}
