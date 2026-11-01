import { createHash, timingSafeEqual } from "node:crypto";
export function validPassword(value: string, expected: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(value).digest(),
    createHash("sha256").update(expected).digest(),
  );
}
