import assert from "node:assert/strict";
import { describe, it } from "node:test";

export { describe, it };

export function expect(actual) {
  return {
    toBe(expected) {
      assert.equal(actual, expected);
    },
    toEqual(expected) {
      assert.deepEqual(actual, expected);
    },
    toContain(expected) {
      assert.equal(includes(actual, expected), true);
    },
    toThrow(expected) {
      if (expected instanceof RegExp) assert.throws(actual, expected);
      else assert.throws(actual);
    },
    not: {
      toContain(expected) {
        assert.equal(includes(actual, expected), false);
      },
    },
    rejects: {
      toBeInstanceOf(type) {
        return assert.rejects(actual, (error) => error instanceof type);
      },
      toThrow(expected) {
        return assert.rejects(actual, expected);
      },
    },
  };
}

function includes(actual, expected) {
  if (typeof actual === "string" || Array.isArray(actual)) {
    return actual.includes(expected);
  }
  return JSON.stringify(actual).includes(String(expected));
}
