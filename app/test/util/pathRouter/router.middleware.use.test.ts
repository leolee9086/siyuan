import { describe, it, expect, beforeEach,test, vi } from "vitest";

import Router from "../../../src/util/pathRouter/core/router.htttpRouter";
import type { Context } from "../../../src/util/pathRouter/core/types";

describe("Router use方法测试", () => {
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

  test("应该正确处理use方法添加中间件", async () => {
    const router = new Router();
    const globalMiddleware = vi.fn((ctx, next) => {
      ctx.body = "Global";
      return next();
    });
    const routeMiddleware = vi.fn((ctx, next) => {
      ctx.body += " -> Route";
      return next();
    });
    
    router.use(globalMiddleware);
    router.get("/users/:id", routeMiddleware);
    
    const dispatch = router.routes();
    
    await dispatch(mockContext, vi.fn());
    
    expect(globalMiddleware).toHaveBeenCalled();
    expect(routeMiddleware).toHaveBeenCalled();
    expect(mockContext.body).toBe("Global -> Route");
  });
});