import { describe, it, expect, beforeEach,test, vi } from "vitest";

import Router from "../../../src/util/pathRouter/core/router.htttpRouter";
import type { Context } from "../../../src/util/pathRouter/core/types";

describe("Router中间件错误处理测试", () => {
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

  test("应该正确处理中间件中的错误", async () => {
    const router = new Router();
    const error = new Error("Test error");
    const errorMiddleware = vi.fn((ctx, next) => {
      throw error;
    });
    
    router.get("/users/:id", errorMiddleware);
    
    const dispatch = router.routes();
    
    try {
      await dispatch(mockContext, vi.fn());
    } catch (e) {
      expect(e).toBe(error);
    }
    
    expect(errorMiddleware).toHaveBeenCalled();
  });
});