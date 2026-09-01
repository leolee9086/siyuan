import { describe, it, expect, beforeEach,test, vi } from "vitest";

import { compose } from "../../../src/util/pathRouter/core/routerUtils";

describe("RouterUtils测试", () => {
  test("应该正确组合中间件", async () => {
    const middleware1 = vi.fn((ctx, next) => {
      ctx.step1 = "completed";
      return next();
    });
    
    const middleware2 = vi.fn((ctx, next) => {
      ctx.step2 = "completed";
      return next();
    });
    
    const middleware3 = vi.fn((ctx, next) => {
      ctx.step3 = "completed";
      return next();
    });
    
    const mockContext = {
      method: "GET",
      path: "/test",
      host: "example.com",
      request: {
        method: "GET" as const,
        url: "/test",
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
      captures: [] as string[],
      set: vi.fn(),
      redirect: vi.fn(),
      step1: "",
      step2: "",
      step3: ""
    };
    const finalNext = vi.fn();
    
    const composed = compose([middleware1, middleware2, middleware3]);
    
    await composed(mockContext, finalNext);
    
    expect(middleware1).toHaveBeenCalledWith(mockContext, expect.any(Function));
    expect(middleware2).toHaveBeenCalledWith(mockContext, expect.any(Function));
    expect(middleware3).toHaveBeenCalledWith(mockContext, expect.any(Function));
    expect(finalNext).toHaveBeenCalled();
    expect(mockContext.step1).toBe("completed");
    expect(mockContext.step2).toBe("completed");
    expect(mockContext.step3).toBe("completed");
  });

  test("应该正确处理空中间件数组", async () => {
    const mockContext = {
      method: "GET",
      path: "/test",
      host: "example.com",
      request: {
        method: "GET" as const,
        url: "/test",
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
      captures: [] as string[],
      set: vi.fn(),
      redirect: vi.fn()
    };
    const finalNext = vi.fn();
    
    const composed = compose([]);
    
    await composed(mockContext, finalNext);
    
    expect(finalNext).toHaveBeenCalled();
  });

  test("应该正确处理单个中间件", async () => {
    const middleware = vi.fn((ctx, next) => {
      ctx.completed = true;
      return next();
    });
    
    const mockContext = {
      method: "GET",
      path: "/test",
      host: "example.com",
      request: {
        method: "GET" as const,
        url: "/test",
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
      captures: [] as string[],
      set: vi.fn(),
      redirect: vi.fn(),
      completed: false
    };
    const finalNext = vi.fn();
    
    const composed = compose([middleware]);
    
    await composed(mockContext, finalNext);
    
    expect(middleware).toHaveBeenCalledWith(mockContext, expect.any(Function));
    expect(finalNext).toHaveBeenCalled();
    expect(mockContext.completed).toBe(true);
  });

  test("应该正确处理异步中间件", async () => {
    const middleware1 = vi.fn(async (ctx, next) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      ctx.step1 = "completed";
      return next();
    });
    
    const middleware2 = vi.fn(async (ctx, next) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      ctx.step2 = "completed";
      return next();
    });
    
    const mockContext = {
      method: "GET",
      path: "/test",
      host: "example.com",
      request: {
        method: "GET" as const,
        url: "/test",
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
      captures: [] as string[],
      set: vi.fn(),
      redirect: vi.fn(),
      step1: "",
      step2: ""
    };
    const finalNext = vi.fn();
    
    const composed = compose([middleware1, middleware2]);
    
    await composed(mockContext, finalNext);
    
    expect(middleware1).toHaveBeenCalledWith(mockContext, expect.any(Function));
    expect(middleware2).toHaveBeenCalledWith(mockContext, expect.any(Function));
    expect(finalNext).toHaveBeenCalled();
    expect(mockContext.step1).toBe("completed");
    expect(mockContext.step2).toBe("completed");
  });

  test("应该正确处理中间件中的错误", async () => {
    const error = new Error("Test error");
    const middleware1 = vi.fn((ctx, next) => {
      ctx.step1 = "completed";
      return next();
    });
    
    const middleware2 = vi.fn((ctx, next) => {
      throw error;
    });
    
    const middleware3 = vi.fn((ctx, next) => {
      ctx.step3 = "should not be called";
      return next();
    });
    
    const mockContext = {
      method: "GET",
      path: "/test",
      host: "example.com",
      request: {
        method: "GET" as const,
        url: "/test",
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
      captures: [] as string[],
      set: vi.fn(),
      redirect: vi.fn(),
      step1: "",
      step2: "",
      step3: ""
    };
    const finalNext = vi.fn();
    
    const composed = compose([middleware1, middleware2, middleware3]);
    
    try {
      await composed(mockContext, finalNext);
      fail("Should have thrown an error");
    } catch (e) {
      expect(e).toBe(error);
    }
    
    expect(middleware1).toHaveBeenCalled();
    expect(middleware2).toHaveBeenCalled();
    expect(middleware3).not.toHaveBeenCalled();
    expect(finalNext).not.toHaveBeenCalled();
    expect(mockContext.step1).toBe("completed");
  });

  test("应该正确处理中间件中的Promise拒绝", async () => {
    const error = new Error("Test error");
    const middleware1 = vi.fn((ctx, next) => {
      ctx.step1 = "completed";
      return next();
    });
    
    const middleware2 = vi.fn((ctx, next) => {
      return Promise.reject(error);
    });
    
    const middleware3 = vi.fn((ctx, next) => {
      ctx.step3 = "should not be called";
      return next();
    });
    
    const mockContext = {
      method: "GET",
      path: "/test",
      host: "example.com",
      request: {
        method: "GET" as const,
        url: "/test",
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
      captures: [] as string[],
      set: vi.fn(),
      redirect: vi.fn(),
      step1: "",
      step2: "",
      step3: ""
    };
    const finalNext = vi.fn();
    
    const composed = compose([middleware1, middleware2, middleware3]);
    
    try {
      await composed(mockContext, finalNext);
      fail("Should have thrown an error");
    } catch (e) {
      expect(e).toBe(error);
    }
    
    expect(middleware1).toHaveBeenCalled();
    expect(middleware2).toHaveBeenCalled();
    expect(middleware3).not.toHaveBeenCalled();
    expect(finalNext).not.toHaveBeenCalled();
    expect(mockContext.step1).toBe("completed");
  });

  test("应该正确处理next函数的多次调用", async () => {
    const middleware = vi.fn((ctx, next) => {
      ctx.count = (ctx.count || 0) + 1;
      return next();
    });
    
    const mockContext = {
      method: "GET",
      path: "/test",
      host: "example.com",
      request: {
        method: "GET" as const,
        url: "/test",
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
      captures: [] as string[],
      set: vi.fn(),
      redirect: vi.fn(),
      count: 0
    };
    const finalNext = vi.fn();
    
    const composed = compose([middleware]);
    
    // 模拟在中间件中多次调用next
    const customNext = vi.fn();
    customNext.mockImplementation(() => {
      if (mockContext.count < 3) {
        return middleware(mockContext, customNext);
      }
      return finalNext();
    });

    await composed(mockContext, customNext);
    
    expect(middleware).toHaveBeenCalledTimes(3);
    expect(finalNext).toHaveBeenCalled();
    expect(mockContext.count).toBe(3);
  });

  test("应该正确处理非函数中间件", () => {
    const middleware1 = vi.fn();
    const middleware2 = "not a function"; 
    const middleware3 = vi.fn();
    
    expect(() => {
      //@ts-expect-error
      compose([middleware1, middleware2, middleware3]);
    }).toThrow("Middleware must be composed of functions!");
  });

  test("应该正确处理非数组中间件", () => {
    const middleware = vi.fn();
    
    expect(() => {
      //@ts-expect-error
      compose(middleware );
    }).toThrow("Middleware stack must be an array!");
  });
});