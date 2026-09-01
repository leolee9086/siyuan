import { describe, it, expect, beforeEach,test, vi } from "vitest";

import Router from "../../../src/util/pathRouter/core/router.htttpRouter";
import type { Context } from "../../../src/util/pathRouter/core/types";
describe("Router路由匹配测试", () => {
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
      body: undefined,
      params: {},
      captures: [],
      set: vi.fn(),
      redirect: vi.fn()
    };
  });

  test("应该正确匹配简单路径", () => {
    const router = new Router();
    const middleware = vi.fn();
    
    router.get("/users", middleware);
    
    const matched = router.match("/users", "GET");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确匹配带参数的路径", () => {
    const router = new Router();
    const middleware = vi.fn();
    
    router.get("/users/:id", middleware);
    
    const matched = router.match("/users/123", "GET");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确匹配多个路由", () => {
    const router = new Router();
    const middleware1 = vi.fn();
    const middleware2 = vi.fn();
    
    router.get("/users", middleware1);
    router.get("/users/:id", middleware2);
    
    const matched1 = router.match("/users", "GET");
    const matched2 = router.match("/users/123", "GET");
    
    expect(matched1.path).toHaveLength(1);
    expect(matched1.pathAndMethod).toHaveLength(1);
    expect(matched1.route).toBe(true);
    
    expect(matched2.path).toHaveLength(1);
    expect(matched2.pathAndMethod).toHaveLength(1);
    expect(matched2.route).toBe(true);
  });

  test("应该正确处理不匹配的路径", () => {
    const router = new Router();
    const middleware = vi.fn();
    
    router.get("/users", middleware);
    
    const matched = router.match("/posts", "GET");
    
    expect(matched.path).toHaveLength(0);
    expect(matched.pathAndMethod).toHaveLength(0);
    expect(matched.route).toBe(false);
  });

  test("应该正确处理不匹配的HTTP方法", () => {
    const router = new Router();
    const middleware = vi.fn();
    
    router.get("/users", middleware);
    
    const matched = router.match("/users", "POST");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(0);
    expect(matched.route).toBe(false);
  });

  test("应该正确处理正则表达式路径", () => {
    const router = new Router();
    const middleware = vi.fn();
    
    router.get(/\/users\/\d+/, middleware);
    
    const matched1 = router.match("/users/123", "GET");
    const matched2 = router.match("/users/abc", "GET");
    
    expect(matched1.path).toHaveLength(1);
    expect(matched1.pathAndMethod).toHaveLength(1);
    expect(matched1.route).toBe(true);
    
    expect(matched2.path).toHaveLength(0);
    expect(matched2.pathAndMethod).toHaveLength(0);
    expect(matched2.route).toBe(false);
  });

  test("应该正确处理数组路径", () => {
    const router = new Router();
    const middleware = vi.fn();
    
    router.get(["/users", "/people"], middleware);
    
    const matched1 = router.match("/users", "GET");
    const matched2 = router.match("/people", "GET");
    const matched3 = router.match("/posts", "GET");
    
    expect(matched1.path).toHaveLength(1);
    expect(matched1.pathAndMethod).toHaveLength(1);
    expect(matched1.route).toBe(true);
    
    expect(matched2.path).toHaveLength(1);
    expect(matched2.pathAndMethod).toHaveLength(1);
    expect(matched2.route).toBe(true);
    
    expect(matched3.path).toHaveLength(0);
    expect(matched3.pathAndMethod).toHaveLength(0);
    expect(matched3.route).toBe(false);
  });

  test("应该正确处理路由参数解析", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx, next) => {
      expect(ctx.params.id).toBe("123");
      return next();
    });
    
    router.get("/users/:id", middleware);
    
    const dispatch = router.routes();
    
    await dispatch(mockContext, vi.fn());
    
    expect(middleware).toHaveBeenCalled();
    expect(mockContext.params.id).toBe("123");
  });

  test("应该正确处理多个路由参数", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx, next) => {
      expect(ctx.params.userId).toBe("123");
      expect(ctx.params.postId).toBe("456");
      return next();
    });
    
    router.get("/users/:userId/posts/:postId", middleware);
    
    mockContext.path = "/users/123/posts/456";
    
    const dispatch = router.routes();
    
    await dispatch(mockContext, vi.fn());
    
    expect(middleware).toHaveBeenCalled();
    expect(mockContext.params.userId).toBe("123");
    expect(mockContext.params.postId).toBe("456");
  });

  test("应该正确处理可选参数", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx, next) => {
      expect(ctx.params.id).toBe("123");
      return next();
    });
    
    router.get("/users/:id?", middleware);
    
    // 测试有参数的情况
    mockContext.path = "/users/123";
    let dispatch = router.routes();
    await dispatch(mockContext, vi.fn());
    
    expect(middleware).toHaveBeenCalled();
    expect(mockContext.params.id).toBe("123");
    
    // 测试无参数的情况
    middleware.mockClear();
    mockContext.path = "/users";
    dispatch = router.routes();
    await dispatch(mockContext, vi.fn());
    
    expect(middleware).toHaveBeenCalled();
  });

  test("应该正确处理通配符参数", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx, next) => {
      expect(ctx.params.path).toBe("a/b/c");
      return next();
    });
    
    router.get("/files/:path(.*)", middleware);
    
    mockContext.path = "/files/a/b/c";
    
    const dispatch = router.routes();
    
    await dispatch(mockContext, vi.fn());
    
    expect(middleware).toHaveBeenCalled();
    expect(mockContext.params.path).toBe("a/b/c");
  });

  test("应该正确设置路由信息", async () => {
    const router = new Router();
    const middleware = vi.fn();
    
    router.get("userRoute", "/users/:id", middleware);
    
    const dispatch = router.routes();
    
    await dispatch(mockContext, vi.fn());
    
    expect(mockContext._matchedRoute).toBe("/users/:id");
    expect(mockContext._matchedRouteName).toBe("userRoute");
    expect(mockContext.routerPath).toBe("/users/:id");
    expect(mockContext.routerName).toBe("userRoute");
  });

  test("应该正确处理exclusive模式", async () => {
    const router = new Router({ exclusive: true });
    const middleware1 = vi.fn();
    const middleware2 = vi.fn();
    
    router.get("/users/:path(.*)", middleware1);
    router.get("/users/:id", middleware2);
    
    mockContext.path = "/users/123";
    
    const dispatch = router.routes();
    
    await dispatch(mockContext, vi.fn());
    
    // 在exclusive模式下，只应该执行最具体的路由
    expect(middleware1).not.toHaveBeenCalled();
    expect(middleware2).toHaveBeenCalled();
  });
});