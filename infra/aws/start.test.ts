import { expect, it } from "vitest";
import { runtimeLaunch } from "./start.mjs";

const settings = { DATABASE_HOST: "database.example.com", DATABASE_PASSWORD: "synthetic@password:/", DATABASE_OWNER_PASSWORD: "synthetic-owner" };
it("keeps migration privileges out of API and worker processes and verifies database TLS", () => {
  for (const mode of ["api", "worker"]) {
    const launch = runtimeLaunch(mode, { ...settings, DATABASE_MIGRATION_URL: "must-not-leak" });
    const url = new URL(launch.env.DATABASE_URL);
    expect(url.username).toBe("crew_app");
    expect(decodeURIComponent(url.password)).toBe(settings.DATABASE_PASSWORD);
    expect(url.searchParams.get("sslmode")).toBe("verify-full");
    expect(launch.env.DATABASE_MIGRATION_URL).toBeUndefined();
    expect(launch.env.DATABASE_OWNER_PASSWORD).toBeUndefined();
    expect(launch.env.DATABASE_PASSWORD).toBeUndefined();
    expect(launch.args).toEqual(["--enable-source-maps", "dist/index.js"]);
  }
});
it("only gives the migration process the owner connection", () => {
  const launch = runtimeLaunch("migrate", settings);
  expect(new URL(launch.env.DATABASE_MIGRATION_URL).username).toBe("crew_owner");
  expect(launch.args[1]).toBe("dist/cli/migrate-database.js");
  expect(launch.env.DATABASE_OWNER_PASSWORD).toBeUndefined();
});
it("starts the web process directly and rejects unsupported modes or ambiguous database hosts", () => {
  expect(runtimeLaunch("web", {}).args).toContain("/app/apps/web/node_modules/vite/bin/vite.js");
  expect(() => runtimeLaunch("shell", settings)).toThrow();
  expect(() => runtimeLaunch("api", { ...settings, DATABASE_HOST: "database.example.com/other" })).toThrow();
  expect(() => runtimeLaunch("api", { ...settings, DATABASE_PASSWORD: "" })).toThrow();
});
