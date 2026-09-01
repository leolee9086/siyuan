import { describe, it, expect, beforeEach,test, vi } from "vitest";

import Router from "../../../src/util/pathRouter/core/router.htttpRouter";
import type { Context } from "../../../src/util/pathRouter/core/types";

// 导入Jest类型定义

describe("Router HTTP方法测试", () => {
  let mockContext: Context;

  beforeEach(() => {
    mockContext = {
      method: "GET",
      path: "/users",
      host: "example.com",
      request: {
        method: "GET",
        url: "/users",
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

  test("应该正确注册GET路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.get("/users", middleware);
    
    const matched = router.match("/users", "GET");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册POST路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.post("/users", middleware);
    
    const matched = router.match("/users", "POST");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册PUT路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.put("/users/:id", middleware);
    
    const matched = router.match("/users/123", "PUT");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册DELETE路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.delete("/users/:id", middleware);
    
    const matched = router.match("/users/123", "DELETE");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册PATCH路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.patch("/users/:id", middleware);
    
    const matched = router.match("/users/123", "PATCH");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册HEAD路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.head("/users", middleware);
    
    const matched = router.match("/users", "HEAD");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册OPTIONS路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.options("/users", middleware);
    
    const matched = router.match("/users", "OPTIONS");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册TRACE路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.trace("/users", middleware);
    
    const matched = router.match("/users", "TRACE");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册COPY路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.copy("/users", middleware);
    
    const matched = router.match("/users", "COPY");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册LOCK路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.lock("/users", middleware);
    
    const matched = router.match("/users", "LOCK");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册MKCOL路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.mkcol("/users", middleware);
    
    const matched = router.match("/users", "MKCOL");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册MOVE路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.move("/users", middleware);
    
    const matched = router.match("/users", "MOVE");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册PURGE路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.purge("/users", middleware);
    
    const matched = router.match("/users", "PURGE");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册PROPFIND路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.propfind("/users", middleware);
    
    const matched = router.match("/users", "PROPFIND");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册PROPPATCH路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.proppatch("/users", middleware);
    
    const matched = router.match("/users", "PROPPATCH");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册UNLOCK路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.unlock("/users", middleware);
    
    const matched = router.match("/users", "UNLOCK");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册REPORT路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.report("/users", middleware);
    
    const matched = router.match("/users", "REPORT");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册MKACTIVITY路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.mkactivity("/users", middleware);
    
    const matched = router.match("/users", "MKACTIVITY");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册CHECKOUT路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.checkout("/users", middleware);
    
    const matched = router.match("/users", "CHECKOUT");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册MERGE路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.merge("/users", middleware);
    
    const matched = router.match("/users", "MERGE");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册M-SEARCH路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router["m-search"]("/users", middleware);
    
    const matched = router.match("/users", "M-SEARCH");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册NOTIFY路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.notify("/users", middleware);
    
    const matched = router.match("/users", "NOTIFY");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册SUBSCRIBE路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.subscribe("/users", middleware);
    
    const matched = router.match("/users", "SUBSCRIBE");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册UNSUBSCRIBE路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.unsubscribe("/users", middleware);
    
    const matched = router.match("/users", "UNSUBSCRIBE");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册SEARCH路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.search("/users", middleware);
    
    const matched = router.match("/users", "SEARCH");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册CONNECT路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.connect("/users", middleware);
    
    const matched = router.match("/users", "CONNECT");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确注册ALL路由", async () => {
    const router = new Router();
    const middleware = vi.fn((ctx: any, next: any) => next());
    
    router.all("/users", middleware);
    
    // 测试多种HTTP方法
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
    
    for (const method of methods) {
      const matched = router.match("/users", method);
      expect(matched.path).toHaveLength(1);
      expect(matched.pathAndMethod).toHaveLength(1);
      expect(matched.route).toBe(true);
    }
  });

  test("应该正确处理命名路由", async () => {
    const router = new Router();
    const middleware = vi.fn();
    
    router.get("userList", "/users", middleware);
    
    const matched = router.match("/users", "GET");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
    expect(matched.path[0].name).toBe("userList");
  });

  test("应该正确处理数组路径", async () => {
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

  test("应该正确处理正则表达式路径", async () => {
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

  test("应该正确处理redirect方法", async () => {
    const router = new Router();
    
    router.redirect("/old-path", "/new-path");
    
    const matched = router.match("/old-path", "GET");
    
    expect(matched.path).toHaveLength(1);
    expect(matched.pathAndMethod).toHaveLength(1);
    expect(matched.route).toBe(true);
  });

  test("应该正确处理命名路由的redirect", async () => {
    const router = new Router();
    
    router.get("oldRoute", "/old-path", vi.fn(() => {}));
    router.get("newRoute", "/new-path", vi.fn(() => {}));
    router.redirect("oldRoute", "newRoute");
    
    const matched = router.match("/old-path", "GET");
    
    expect(matched.path).toHaveLength(2); // 原路由和重定向路由
    expect(matched.pathAndMethod).toHaveLength(2);
    expect(matched.route).toBe(true);
  });
});