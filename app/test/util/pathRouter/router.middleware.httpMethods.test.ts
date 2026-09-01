import { describe, it, expect, beforeEach,test, vi } from "vitest";

import Router from "../../../src/util/pathRouter/core/router.htttpRouter";
import type { Context } from "../../../src/util/pathRouter/core/types";

describe("Router HTTP方法处理测试", () => {
  let mockContext: Context;

  beforeEach(() => {
    mockContext = {
      method: "GET",
      path: "/users/123",
      host: "example.com",
      request: {
        method: "GET",
        url: "/users/123",
        params: {},
        query: {},
        headers: {},
        body: undefined
      },
      response: {
        status: 200,
        headers: {},
        set: vi.fn(),
        redirect: vi.fn(),
        body: undefined
      },
      status: 200,
      params: {},
      captures: [],
      set: vi.fn(),
      redirect: vi.fn(),
      body: undefined
    };
  });

  test("应该正确处理不支持的HTTP方法", async () => {
    const router = new Router();
    const middleware = vi.fn();
    
    router.get("/users/:id", middleware);
    
    const allowedMethods = router.allowedMethods();
    
    mockContext.method = "PATCH";
    // 修复：确保matched属性存在并且包含路由层
    mockContext.matched = [router.stack[0]];
    // 修复：设置status为404以触发方法检查
    mockContext.status = 404;
    
    await allowedMethods(mockContext, vi.fn());
    
    expect(mockContext.status).toBe(405);
    expect(mockContext.set).toHaveBeenCalledWith("Allow", "GET, HEAD");
  });

  test("应该正确处理未实现的HTTP方法", async () => {
    const router = new Router();
    const middleware = vi.fn();
    
    router.get("/users/:id", middleware);
    
    const allowedMethods = router.allowedMethods({ throw: true });
    
    mockContext.method = "UNKNOWN";
    // 修复：确保matched属性存在并且包含路由层
    mockContext.matched = [router.stack[0]];
    // 修复：设置status为404以触发方法检查
    mockContext.status = 404;
    
    let errorThrown = false;
    try {
      await allowedMethods(mockContext, vi.fn());
    } catch (error) {
      errorThrown = true;
      // 修复：使用字符串匹配而不是精确匹配，避免ANSI转义序列问题
      expect(error.message).toMatch(/not implemented/);
    }
    
    expect(errorThrown).toBe(true);
  });
});