import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const t = JSON.parse(readFileSync(new URL("./build.json", import.meta.url), "utf8"));
it("builds a pinned public revision with no runtime, database or secret permissions", () => {
  const project = t.Resources.Build.Properties;
  expect(project.Source.Type).toBe("NO_SOURCE");
  expect(project).not.toHaveProperty("Triggers");
  expect(project.ConcurrentBuildLimit).toBe(1);
  expect(t.Parameters.SourceSha.AllowedPattern).toBe("^[0-9a-f]{40}$");
  const spec = JSON.parse(project.Source.BuildSpec);
  expect(spec.phases.pre_build.commands).toContain('test "$(git rev-parse HEAD)" = "$SOURCE_SHA"');
  expect(spec.phases.build.commands.at(-2)).toBe('docker push "$REPOSITORY_URI:$SOURCE_SHA"');
  const statements = t.Resources.BuildRole.Properties.Policies[0].PolicyDocument.Statement;
  expect(statements.flatMap((s: any) => s.Action).every((a: string) => a.startsWith("ecr:") || a.startsWith("logs:"))).toBe(true);
  expect(statements.filter((s: any) => s.Resource === "*").flatMap((s: any) => s.Action)).toEqual(["ecr:GetAuthorizationToken"]);
});
