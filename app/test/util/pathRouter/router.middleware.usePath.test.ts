import { describe, it, expect, beforeEach,test, vi } from "vitest";

import Router from "../../../src/util/pathRouter/core/router.htttpRouter";
import type { Context } from "../../../src/util/pathRouter/core/types";

describe("Router路径相关use方法测试", () => {
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

  test("应该正确处理带路径的use方法", async () => {
    const router = new Router();
    const pathMiddleware = vi.fn((ctx, next) => {
      ctx.body = "Path";
      return next();
    });
    const routeMiddleware = vi.fn((ctx, next) => {
      ctx.body += " -> Route";
      return next();
    });
    
    router.use("/api", pathMiddleware);
    router.get("/api/users/:id", routeMiddleware);
    
    mockContext.path = "/api/users/123";
    
    const dispatch = router.routes();
    
    await dispatch(mockContext, vi.fn());
    
    expect(pathMiddleware).toHaveBeenCalled();
    expect(routeMiddleware).toHaveBeenCalled();
    expect(mockContext.body).toBe("Path -> Route");
  });

  test("应该正确处理数组路径的use方法", async () => {
    const router = new Router();
    const pathMiddleware = vi.fn((ctx, next) => {
      ctx.body = "Path";
      return next();
    });
    const routeMiddleware = vi.fn((ctx, next) => {
      ctx.body += " -> Route";
      return next();
    });
    
    router.use(["/api", "/v1"], pathMiddleware);
    router.get("/api/users/:id", routeMiddleware);
    
    mockContext.path = "/api/users/123";
    
    const dispatch = router.routes();
    
    await dispatch(mockContext, vi.fn());
    
    expect(pathMiddleware).toHaveBeenCalled();
    expect(routeMiddleware).toHaveBeenCalled();
    expect(mockContext.body).toBe("Path -> Route");
  });
});