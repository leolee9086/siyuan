import { describe, it, expect, beforeEach,test, vi } from "vitest";

import Router from "../../../src/util/pathRouter/core/router.htttpRouter";
import type { Context } from "../../../src/util/pathRouter/core/types";

describe("Router中间件next调用测试", () => {
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

  test("应该正确处理中间件链中的next调用", async () => {
    const router = new Router();
    const middleware1 = vi.fn((ctx, next) => {
      ctx.body = "Step 1";
      return next();
    });
    const middleware2 = vi.fn((ctx, next) => {
      // 不调用next，中断中间件链
      ctx.body += " -> Step 2 (end)";
    });
    const middleware3 = vi.fn((ctx, next) => {
      ctx.body += " -> Step 3";
      return next();
    });
    
    router.get("/users/:id", middleware1, middleware2, middleware3);
    
    const dispatch = router.routes();
    
    await dispatch(mockContext, vi.fn());
    
    expect(middleware1).toHaveBeenCalled();
    expect(middleware2).toHaveBeenCalled();
    expect(middleware3).not.toHaveBeenCalled();
    expect(mockContext.body).toBe("Step 1 -> Step 2 (end)");
  });
});