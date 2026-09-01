import { describe, it, expect, beforeEach,test, vi } from "vitest";
import Router from "../../../src/util/pathRouter/core/router.htttpRouter";
import type { Context } from "../../../src/util/pathRouter/core/types";

describe("Router中间件异步操作测试", () => {
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

  test("应该正确处理中间件中的异步操作", async () => {
    const router = new Router();
    const asyncMiddleware = vi.fn(async (ctx, next) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      ctx.body = "Async";
      return next();
    });
    
    router.get("/users/:id", asyncMiddleware);
    
    const dispatch = router.routes();
    
    await dispatch(mockContext, vi.fn());
    
    expect(asyncMiddleware).toHaveBeenCalled();
    expect(mockContext.body).toBe("Async");
  });
});