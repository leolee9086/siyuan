import { describe, it, expect, beforeEach,test, vi } from "vitest";

import Router from "../../../src/util/pathRouter/core/router.htttpRouter";
import type { Context } from "../../../src/util/pathRouter/core/types";

describe("Router单个中间件测试", () => {
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

  test("应该正确执行单个中间件", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx, next) => {
      ctx.body = "Hello World";
      return next();
    });
    
    router.get("/users/:id", middleware);
    
    const dispatch = router.routes();
    
    await dispatch(mockContext, vi.fn());
    
    expect(middleware).toHaveBeenCalled();
    expect(mockContext.body).toBe("Hello World");
  });
});