import { describe, it, expect, beforeEach,test, vi } from "vitest";

import Router from "../../../src/util/pathRouter/core/router.htttpRouter";
import type { Context } from "../../../src/util/pathRouter/core/types";

describe("Router allowedMethods测试", () => {
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
        body: undefined,
        set: vi.fn(),
        redirect: vi.fn()
      },
      status: 200,
      body: undefined,
      params: {},
      captures: [],
      set: vi.fn(),
      redirect: vi.fn()
    };
  });

  test("应该正确处理allowedMethods中间件", async () => {
    const router = new Router();
    const middleware = vi.fn();
    
    router.get("/users/:id", middleware);
    router.post("/users/:id", middleware);
    
    const allowedMethods = router.allowedMethods();
    
    mockContext.method = "OPTIONS";
    // 修复：确保matched属性存在并且包含所有路由层
    mockContext.matched = router.stack;
    // 修复：设置status为404或未设置，以便allowedMethods中间件执行
    mockContext.status = 404;
    
    await allowedMethods(mockContext, vi.fn());
    
    expect(mockContext.status).toBe(200);
    expect(mockContext.set).toHaveBeenCalledWith("Allow", "GET, HEAD, POST");
  });
});