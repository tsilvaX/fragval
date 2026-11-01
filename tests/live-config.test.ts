import { test } from "node:test";
import assert from "node:assert/strict";
import { updateEnvironment } from "../scripts/setup-live.mjs";
test("secure setup preserves unrelated secrets and password and replaces duplicate key entries", () => {
  const input =
    '# Existing deployment\nCOURT_PASSWORD="existing-test-password"\nUNRELATED_SECRET="keep-this-test-value"\nHENRIK_API_KEY="old-test-key"\nHENRIK_API_KEY="duplicate-test-key"\n';
  const output = updateEnvironment(input, {
    HENRIK_API_KEY: "new-test-key",
    DATA_PROVIDER: "henrik",
  });
  assert.ok(output.includes('COURT_PASSWORD="existing-test-password"'));
  assert.ok(output.includes('UNRELATED_SECRET="keep-this-test-value"'));
  assert.ok(output.includes("# Existing deployment"));
  assert.ok(!output.includes("old-test-key"));
  assert.ok(!output.includes("duplicate-test-key"));
  assert.equal(output.match(/HENRIK_API_KEY=/g)?.length, 1);
});
