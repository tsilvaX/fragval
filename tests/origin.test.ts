import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedOrigin } from "../src/lib/origin";
test("refresh accepts the browser host when Next normalizes the internal URL", () => {
  const request = new Request("http://localhost:3000/api/refresh", {
    method: "POST",
    headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
  });
  assert.equal(allowedOrigin(request), true);
});
test("refresh rejects unrelated origins and malformed origin values", () => {
  for (const origin of ["https://untrusted.invalid", "null", "not a URL"]) {
    const r = new Request("http://localhost:3000/api/refresh", {
      headers: { host: "localhost:3000", origin },
    });
    assert.equal(allowedOrigin(r), false);
  }
});
test("only a configured canonical origin permits a TLS proxy's external origin", () => {
  const r = new Request("http://localhost:3000/api/refresh", {
    headers: { host: "localhost:3000", origin: "https://court.example.com" },
  });
  assert.equal(allowedOrigin(r), false);
  assert.equal(allowedOrigin(r, "https://court.example.com"), true);
});
test("explicit cross-site browser requests are rejected even with a matching origin", () => {
  const r = new Request("http://localhost:3000/api/refresh", {
    headers: {
      origin: "http://localhost:3000",
      "sec-fetch-site": "cross-site",
    },
  });
  assert.equal(allowedOrigin(r), false);
});
