import { describe, it, expect, beforeEach,test, vi } from "vitest";

import Router from "../../../src/util/pathRouter/core/router.htttpRouter";
import type { Context, MiddlewareFunction } from "../../../src/util/pathRouter/core/types";

describe("Router嵌套路由测试", () => {
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

  test("应该正确处理嵌套路由", async () => {
    const router = new Router();
    const nestedRouter = new Router();
    
    const parentMiddleware = vi.fn((ctx, next) => {
      ctx.body = "Parent";
      return next();
    });
    
    const childMiddleware = vi.fn((ctx, next) => {
      ctx.body += " -> Child";
      return next();
    });
    
    router.use("/api", parentMiddleware);
    nestedRouter.get("/users/:id", childMiddleware);
    router.use("/api", nestedRouter.routes() );
    
    mockContext.path = "/api/users/123";
    
    const dispatch = router.routes();
    await dispatch(mockContext, vi.fn());
    
    expect(parentMiddleware).toHaveBeenCalled();
    expect(childMiddleware).toHaveBeenCalled();
    expect(mockContext.body).toBe("Parent -> Child");
  });
});