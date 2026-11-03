import { setupWorker } from "msw/browser";
import { isWalkthroughScenario, walkthroughHandlers } from "./devScenario";
import { handlers } from "./handlers";

export const worker = setupWorker(
  ...(isWalkthroughScenario() ? walkthroughHandlers : []),
  ...handlers,
);
