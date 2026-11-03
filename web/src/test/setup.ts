import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "../mocks/server";

beforeAll(() => {
  server.listen({
    onUnhandledRequest: "error",
  } as NonNullable<Parameters<typeof server.listen>[0]>);
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
