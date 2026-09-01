import { describe, it, expect, beforeEach,test, vi } from "vitest";

import Router from "../../../src/util/pathRouter/core/router.htttpRouter";
import type { Context } from "../../../src/util/pathRouter/core/types";

describe("Router参数中间件测试", () => {
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

  test("应该正确处理参数中间件", async () => {
    const router = new Router();
    const paramMiddleware = vi.fn((param, ctx, next) => {
      ctx.user = { id: param };
      return next();
    });
    const routeMiddleware = vi.fn((ctx, next) => {
      ctx.body = `User ID: ${ctx.user.id}`;
      return next();
    });
    
    router.param("id", paramMiddleware);
    router.get("/users/:id", routeMiddleware);
    
    const dispatch = router.routes();
    
    await dispatch(mockContext, vi.fn());
    
    expect(paramMiddleware).toHaveBeenCalledWith("123", mockContext, expect.any(Function));
    expect(routeMiddleware).toHaveBeenCalled();
    expect(mockContext.body).toBe("User ID: 123");
  });
});