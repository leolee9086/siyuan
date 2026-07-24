import { describe, test, expect } from "vitest";
import { createTypedMatcher } from "../../../src/util/lib/matchCondition";

describe("matchCondition - 基础匹配功能测试", () => {
  // 测试基本字符串匹配
  test("应该匹配简单的字符串条件", () => {
    const matcher = createTypedMatcher(
      { role: "admin" },
      () => ({ permissions: ["read", "write"] })
    );

    const result = matcher({ role: "admin" });
    
    expect(result).toBeDefined();
    expect(result?.matched).toBe(true);
    expect(result?.payload).toEqual({ permissions: ["read", "write"] });
  });

  // 测试布尔值匹配
  test("应该匹配布尔值条件", () => {
    const matcher = createTypedMatcher(
      { enabled: true, active: false },
      () => ({ status: "active" })
    );

    const result = matcher({ enabled: true, active: false });
    
    expect(result?.matched).toBe(true);
    expect(result?.payload).toEqual({ status: "active" });
  });

  // 测试数字匹配
  test("应该匹配数字条件", () => {
    const matcher = createTypedMatcher(
      { level: 5, score: 100 },
      () => ({ result: "passed" })
    );

    const result = matcher({ level: 5, score: 100 });
    
    expect(result?.matched).toBe(true);
    expect(result?.payload).toEqual({ result: "passed" });
  });

  // 测试不匹配情况
  test("应该在条件不匹配时返回 undefined", () => {
    const matcher = createTypedMatcher(
      { role: "admin" },
      () => ({ permissions: ["read", "write"] })
    );

    const result = matcher({ role: "user" });
    
    expect(result).toBeUndefined();
  });

  // 测试部分条件不匹配
  test("应该在部分条件不匹配时返回 undefined", () => {
    const matcher = createTypedMatcher(
      { role: "admin", enabled: true },
      () => ({ permissions: ["read", "write"] })
    );

    const result = matcher({ role: "admin", enabled: false });
    
    expect(result).toBeUndefined();
  });

  // 测试条件缺失
  test("应该在条件缺失时返回 undefined", () => {
    const matcher = createTypedMatcher(
      { role: "admin", enabled: true },
      () => ({ permissions: ["read", "write"] })
    );

    const result = matcher({ role: "admin" });
    
    expect(result).toBeUndefined();
  });
});
