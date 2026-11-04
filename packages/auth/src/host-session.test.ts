import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  hostSessionConfig,
  verifyHostSessionAssertion,
} from "./host-session.js";

const config = {
  secret: "test-only-secret-".repeat(5),
  origin: "http://localhost:3000",
};
const claims = {
  iss: config.origin,
  aud: "manfacter-crew",
  sub: "11111111-1111-4111-a111-111111111111",
  sid: "22222222-2222-4222-a222-222222222222",
  jti: "a".repeat(43),
  name: "Example Admin",
  iat: 1000,
  exp: 1030,
  session_exp: 1075,
};
function sign(
  payload: unknown,
  key = config.secret,
  header = { alg: "HS256", typ: "JWT" },
) {
  const body = [header, payload]
    .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
    .join(".");
  return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`;
}
describe("host identity assertions", () => {
  it("accepts a bounded host identity and refuses forged signatures or alternate algorithms", () => {
    expect(verifyHostSessionAssertion(sign(claims), config, 1001).sub).toBe(
      claims.sub,
    );
    expect(() =>
      verifyHostSessionAssertion(sign(claims, "wrong-key"), config, 1001),
    ).toThrow();
    expect(() =>
      verifyHostSessionAssertion(
        sign(claims, config.secret, { alg: "none", typ: "JWT" }),
        config,
        1001,
      ),
    ).toThrow();
    expect(() =>
      verifyHostSessionAssertion(sign(claims) + "x", config, 1001),
    ).toThrow();
    expect(() =>
      verifyHostSessionAssertion("a".repeat(2049), config, 1001),
    ).toThrow();
  });
  it.each([
    { exp: 1000 },
    { exp: 1031 },
    { iat: 1010 },
    { session_exp: 1076 },
    { session_exp: 1020 },
    { iss: "http://evil.example" },
    { aud: "other" },
    { sub: "not-a-user" },
    { sid: "not-a-session" },
    { jti: "short" },
    { name: "" },
    { role: "admin" },
  ])("rejects expired, overlong or wrong-scope claims: %j", (patch) => {
    expect(() =>
      verifyHostSessionAssertion(sign({ ...claims, ...patch }), config, 1001),
    ).toThrow();
  });
  it("only enables the flow with a complete secret and exact HTTPS or loopback origin", () => {
    expect(hostSessionConfig()).toBeUndefined();
    expect(hostSessionConfig(config.secret, config.origin)).toEqual(config);
    for (const origin of [
      "http://public.example",
      "https://example.com/path",
      "https://example.com?x=1",
      "https://user@example.com",
    ])
      expect(() => hostSessionConfig(config.secret, origin)).toThrow();
    expect(() => hostSessionConfig("short", config.origin)).toThrow();
  });
});
