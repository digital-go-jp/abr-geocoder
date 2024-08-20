import { describe, expect, jest, test } from "@jest/globals";

declare global {
  namespace jest {
    interface Matchers<R> {
      matchObjectContaining<E = unknown, T = unknown>(members: readonly E[], object: T): R;
    }
  }
}