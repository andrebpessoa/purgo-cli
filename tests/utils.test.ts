import { describe, test, expect } from "bun:test";
import { toBytes, deduplicatePaths } from "../src/utils";

describe("toBytes", () => {
  test("correctly converts finite number", () => {
    expect(toBytes(1024)).toBe(1024);
    expect(toBytes(0)).toBe(0);
    expect(toBytes(999.5)).toBe(999.5);
  });

  test("returns 0 for infinite numbers or NaN", () => {
    expect(toBytes(Infinity)).toBe(0);
    expect(toBytes(-Infinity)).toBe(0);
    expect(toBytes(NaN)).toBe(0);
  });

  test("converts bigint to number", () => {
    expect(toBytes(BigInt(2048))).toBe(2048);
    expect(toBytes(BigInt(0))).toBe(0);
    expect(toBytes(BigInt(999999))).toBe(999999);
  });

  test("extracts size property from object", () => {
    expect(toBytes({ size: 512 })).toBe(512);
    expect(toBytes({ size: 0 })).toBe(0);
  });

  test("extracts bytes property from object", () => {
    expect(toBytes({ bytes: 256 })).toBe(256);
    expect(toBytes({ bytes: 1024 })).toBe(1024);
  });

  test("extracts raw property from object", () => {
    expect(toBytes({ raw: 128 })).toBe(128);
    expect(toBytes({ raw: 2048 })).toBe(2048);
  });

  test("uses valueOf() when available", () => {
    const obj = { valueOf: () => 4096 };
    expect(toBytes(obj)).toBe(4096);
  });

  test("prioritizes size over bytes and raw", () => {
    expect(toBytes({ size: 100, bytes: 200, raw: 300 })).toBe(100);
  });

  test("prioritizes bytes over raw when size does not exist", () => {
    expect(toBytes({ bytes: 200, raw: 300 })).toBe(200);
  });

  test("returns 0 for unknown values", () => {
    expect(toBytes(null)).toBe(0);
    expect(toBytes(undefined)).toBe(0);
    expect(toBytes("string")).toBe(0);
    expect(toBytes(true)).toBe(0);
    expect(toBytes({})).toBe(0);
    expect(toBytes([])).toBe(0);
  });

  test("returns 0 for object without recognized properties", () => {
    expect(toBytes({ unknown: 123 })).toBe(0);
    expect(toBytes({ value: 456 })).toBe(0);
  });
});

describe("deduplicatePaths", () => {
  test("remove child paths keeping only parent directories", () => {
    const paths = ["a", "a/b", "a/b/c", "x"];
    const result = deduplicatePaths(paths);
    expect(result).toEqual(["a", "x"]);
  });

  test("keeps independent paths", () => {
    const paths = ["node_modules", "dist", "build"];
    const result = deduplicatePaths(paths);
    expect(result.sort()).toEqual(["build", "dist", "node_modules"]);
  });

  test("normalizes backslashes (Windows)", () => {
    const paths = ["a\\b", "a\\b\\c", "a"];
    const result = deduplicatePaths(paths);
    expect(result).toEqual(["a"]);
  });

  test("sorts by length before deduplication", () => {
    const paths = ["a/b/c/d", "a", "a/b"];
    const result = deduplicatePaths(paths);
    expect(result).toEqual(["a"]);
  });

  test("returns empty array for empty input", () => {
    expect(deduplicatePaths([])).toEqual([]);
  });

  test("keeps only unique path", () => {
    expect(deduplicatePaths(["single"])).toEqual(["single"]);
  });

  test("removes only actual subpaths", () => {
    const paths = ["ab", "abc", "ab/c"];
    const result = deduplicatePaths(paths);
    expect(result).toEqual(["ab", "abc"]);
  });

  test("handles duplicate paths", () => {
    const paths = ["a", "a", "b", "b"];
    const result = deduplicatePaths(paths);
    expect(result).toEqual(["a", "b"]);
  });

  test("handles multiple levels of hierarchy", () => {
    const paths = [
      "packages/app/node_modules",
      "packages/app/node_modules/lib",
      "packages/lib/node_modules",
      "node_modules"
    ];
    const result = deduplicatePaths(paths);
    expect(result).toEqual([
      "node_modules",
      "packages/app/node_modules",
      "packages/lib/node_modules"
    ]);
  });
});

