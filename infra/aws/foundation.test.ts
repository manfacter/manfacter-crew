import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const template = JSON.parse(readFileSync(new URL("./foundation.json", import.meta.url), "utf8"));
const resources = template.Resources;

it("keeps durable state encrypted, private and recoverable", () => {
  expect(resources.Database.Properties).toMatchObject({
    PubliclyAccessible: false, StorageEncrypted: true,
    DeletionProtection: true, BackupRetentionPeriod: 7,
    ManageMasterUserPassword: true,
  });
  expect(resources.Database.DeletionPolicy).toBe("Snapshot");
  expect(resources.Files.Properties.Encrypted).toBe(true);
  expect(resources.Files.Properties.BackupPolicy.Status).toBe("ENABLED");
  expect(resources.Files.Properties.FileSystemPolicy.Statement[0]).toMatchObject({
    Effect: "Deny", Condition: { Bool: { "aws:SecureTransport": "false" } },
  });
  expect(resources.Files.DeletionPolicy).toBe("Retain");
});

it("only admits database and file connections from the workload and keeps its user unprivileged", () => {
  for (const name of ["DatabaseSecurityGroup", "FilesSecurityGroup"]) {
    const rules = resources[name].Properties.SecurityGroupIngress;
    expect(rules).toHaveLength(1);
    expect(rules[0].SourceSecurityGroupId).toEqual({ Ref: "RuntimeSecurityGroup" });
    expect(rules[0].CidrIp).toBeUndefined();
  }
  expect(resources.RuntimeSecurityGroup.Properties.SecurityGroupIngress).toBeUndefined();
  expect(resources.FilesAccessPoint.Properties.PosixUser).toEqual({ Uid: "1000", Gid: "1000" });
});

it("generates credentials in the secret service and never puts their values in outputs", () => {
  const secrets = Object.values(resources).filter((resource: any) => resource.Type === "AWS::SecretsManager::Secret") as any[];
  expect(secrets).toHaveLength(5);
  for (const secret of secrets) {
    expect(secret.Properties.SecretString).toBeUndefined();
    expect(secret.Properties.GenerateSecretString.PasswordLength).toBeGreaterThanOrEqual(48);
    expect(secret.DeletionPolicy).toBe("Retain");
  }
  expect(JSON.stringify(template.Outputs)).not.toContain("resolve:secretsmanager");
});
