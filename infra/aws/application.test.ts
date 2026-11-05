import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const t = JSON.parse(readFileSync(new URL("./application.json", import.meta.url), "utf8"));
const runtime = t.Resources.Runtime.Properties;

it("separates the migration credential from all permanent workloads", () => {
  const containers = runtime.ContainerDefinitions;
  expect(containers.map((c: any) => c.Name)).toEqual(["api", "worker", "web"]);
  for (const c of containers) {
    expect(c.User).toBe("1000");
    expect(c.Secrets.some((s: any) => s.Name === "DATABASE_OWNER_PASSWORD")).toBe(false);
    expect(c.LogConfiguration.Options.mode).toBe("blocking");
    expect(c.HealthCheck).toBeDefined();
  }
  expect(t.Resources.Migration.Properties.ContainerDefinitions[0].Secrets.some((s: any) => s.Name === "DATABASE_OWNER_PASSWORD")).toBe(true);
  expect(t.Resources.Service.Condition).toBe("Launch");
  expect(t.Parameters.StartApplication.Default).toBe("false");
});

it("starts unprivileged processes without public API/database ingress or plaintext secret values", () => {
  expect(runtime.NetworkMode).toBe("awsvpc");
  expect(runtime.RequiresCompatibilities).toEqual(["FARGATE"]);
  expect(t.Resources.RuntimeIngress.Properties.FromPort).toBe(5173);
  expect(t.Resources.RuntimeIngress.Properties.SourceSecurityGroupId).toEqual({ Ref: "GatewaySecurityGroup" });
  for (const c of runtime.ContainerDefinitions) {
    for (const s of c.Secrets) expect(s.ValueFrom).toHaveProperty("Fn::ImportValue");
    expect(c.Environment.some((e: any) => /(?:_PASSWORD|_SECRET|ENCRYPTION_KEY)$/.test(e.Name))).toBe(false);
  }
  for (const volume of runtime.Volumes) {
    expect(volume.EFSVolumeConfiguration.TransitEncryption).toBe("ENABLED");
    expect(volume.EFSVolumeConfiguration.AuthorizationConfig.IAM).toBe("ENABLED");
  }
});

it("keeps healthy tasks serving during deployments and rolls back failed releases", () => {
  const service = t.Resources.Service.Properties;
  expect(service.DeploymentConfiguration).toEqual({ MinimumHealthyPercent: 100, MaximumPercent: 200, DeploymentCircuitBreaker: { Enable: true, Rollback: true } });
  expect(service.HealthCheckGracePeriodSeconds).toBeGreaterThanOrEqual(120);
  expect(t.Parameters.ImageUri.AllowedPattern).toContain("@sha256:");
  const pattern = new RegExp(`^${t.Parameters.ImageUri.AllowedPattern}$`);
  expect(pattern.test(`111111111111.dkr.ecr.eu-central-1.amazonaws.com/crew@sha256:${"a".repeat(64)}`)).toBe(true);
  expect(pattern.test("crew:latest")).toBe(false);
});
