import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export function runtimeLaunch(mode, source) {
  if (!["api", "worker", "web", "migrate"].includes(mode)) throw new Error("Unknown Crew process");
  const env = { ...source };
  if (mode !== "web") {
    const host = env.DATABASE_HOST;
    if (!host || !/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$/.test(host) || !env.DATABASE_PASSWORD)
      throw new Error("Crew database configuration is incomplete");
    function connection(user, password) {
      if (!password) throw new Error("Crew database credential is missing");
      const url = new URL(`postgresql://${host}:5432/crew`);
      url.username = user;
      url.password = password;
      url.searchParams.set("sslmode", "verify-full");
      return url.href;
    }
    env.DATABASE_URL = connection("crew_app", env.DATABASE_PASSWORD);
    if (mode === "migrate") env.DATABASE_MIGRATION_URL = connection("crew_owner", env.DATABASE_OWNER_PASSWORD);
    else delete env.DATABASE_MIGRATION_URL;
  }
  delete env.DATABASE_PASSWORD;
  delete env.DATABASE_OWNER_PASSWORD;
  const cwd = mode === "worker" ? "/app/apps/worker" : mode === "web" ? "/app/apps/web" : "/app/apps/api";
  const args = mode === "web"
    ? ["/app/apps/web/node_modules/vite/bin/vite.js", "preview", "--host", "0.0.0.0", "--port", "5173"]
    : ["--enable-source-maps", mode === "migrate" ? "dist/cli/migrate-database.js" : "dist/index.js"];
  return { cwd, args, env };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const launch = runtimeLaunch(process.argv[2], process.env);
  const child = spawn(process.execPath, launch.args, { cwd: launch.cwd, env: launch.env, stdio: "inherit" });
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
  child.once("error", () => { process.exitCode = 1; });
  child.once("exit", (code) => { process.exitCode = code ?? 1; });
}
