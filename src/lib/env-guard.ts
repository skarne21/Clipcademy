export function assertProductionEnv(): void {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DEV_SKIP_VALIDATION === "true"
  ) {
    throw new Error(
      "DEV_SKIP_VALIDATION=true is not allowed when NODE_ENV=production. Disable it before deploying.",
    );
  }
}
