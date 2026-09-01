import { describe, it, expect, beforeEach,test, vi } from "vitest";

import Layer from "../../../src/util/pathRouter/core/layer";
import type { Context } from "../../../src/util/pathRouter/core/types";

describe("Layer类测试", () => {
  test("应该正确创建Layer实例", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users", ["GET"], middleware);
    
    expect(layer.path).toBe("/users");
    expect(layer.methods).toEqual(["GET", "HEAD"]);
    expect(layer.stack).toEqual([middleware]);
    expect(layer.name).toBeNull();
    expect(layer.regexp).toBeInstanceOf(RegExp);
  });

  test("应该正确创建带名称的Layer实例", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users", ["GET"], middleware, { name: "userList" });
    
    expect(layer.name).toBe("userList");
  });

  test("应该正确处理多个HTTP方法", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users", ["GET", "POST"], middleware);
    
    expect(layer.methods).toEqual(["GET", "POST", "HEAD"]);
  });

  test("应该正确处理多个中间件", () => {
    const middleware1 = vi.fn();
    const middleware2 = vi.fn();
    const layer = new Layer("/users", ["GET"], [middleware1, middleware2]);
    
    expect(layer.stack).toEqual([middleware1, middleware2]);
  });

  test("应该正确处理正则表达式路径", () => {
    const middleware = vi.fn();
    const pathRegex = /\/users\/\d+/;
    const layer = new Layer(pathRegex, ["GET"], middleware);
    
    expect(layer.path).toBe(pathRegex);
    expect(layer.regexp).toBeInstanceOf(RegExp);
  });

  test("应该正确匹配路径", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users/:id", ["GET"], middleware);
    
    expect(layer.match("/users/123")).toBe(true);
    expect(layer.match("/users/123/posts")).toBe(false);
    expect(layer.match("/posts/123")).toBe(false);
  });

  test("应该正确匹配正则表达式路径", () => {
    const middleware = vi.fn();
    const pathRegex = /\/users\/\d+/;
    const layer = new Layer(pathRegex, ["GET"], middleware);
    
    expect(layer.match("/users/123")).toBe(true);
    expect(layer.match("/users/abc")).toBe(false);
  });

  test("应该正确提取路径参数", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users/:id/posts/:postId", ["GET"], middleware);
    
    const captures = layer.captures("/users/123/posts/456");
    
    expect(captures).toEqual(["123", "456"]);
  });

  test("应该正确处理ignoreCaptures选项", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users/:id", ["GET"], middleware, { ignoreCaptures: true });
    
    const captures = layer.captures("/users/123");
    
    expect(captures).toEqual([]);
  });

  test("应该正确解析路径参数", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users/:id/posts/:postId", ["GET"], middleware);
    
    const params = layer.params("/users/123/posts/456", ["123", "456"]);
    
    expect(params).toEqual({
      id: "123",
      postId: "456"
    });
  });

  test("应该正确处理已存在的参数", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users/:id", ["GET"], middleware);
    
    const existingParams = { existing: "value" };
    const params = layer.params("/users/123", ["123"], existingParams);
    
    expect(params).toEqual({
      existing: "value",
      id: "123"
    });
  });

  test("应该正确生成URL", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users/:id", ["GET"], middleware);
    
    const url = layer.url({ id: "123" });
    
    expect(url).toBe("/users/123");
  });

  test("应该正确生成带查询参数的URL", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users/:id", ["GET"], middleware);
    
    const url = layer.url({ id: "123" }, { query: "sort=name" });
    
    expect(url).toBe("/users/123?sort=name");
  });

  test("应该正确生成带对象查询参数的URL", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users/:id", ["GET"], middleware);
    
    const url = layer.url({ id: "123" }, { query: { sort: "name", page: 1 } });
    
    expect(url).toBe("/users/123?sort=name&page=1");
  });

  test("应该正确处理参数中间件", () => {
    const middleware = vi.fn();
    const paramMiddleware = vi.fn((param, ctx, next) => {
      ctx.user = { id: param };
      return next();
    });
    
    const layer = new Layer("/users/:id", ["GET"], middleware);
    layer.param("id", paramMiddleware);
    
    const mockContext: Context = {
      method: "GET",
      path: "/users/123",
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
        body: undefined,
        headers: {},
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
    const next = vi.fn();
    
    // 模拟参数中间件的调用
    const paramFn = layer.stack.find(fn => fn.param === "id");
    if (paramFn) {
      paramFn(mockContext, next);
    }
    
    expect(paramMiddleware).toHaveBeenCalledWith(undefined, mockContext, next);
  });

  test("应该正确设置前缀", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users", ["GET"], middleware);
    
    layer.setPrefix("/api");
    
    expect(layer.path).toBe("/api/users");
  });

  test("应该正确处理根路径的前缀", () => {
    const middleware = vi.fn();
    const layer = new Layer("/", ["GET"], middleware);
    
    layer.setPrefix("/api");
    
    expect(layer.path).toBe("/api");
  });

  test("应该正确处理strict选项", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users/", ["GET"], middleware, { strict: true });
    
    expect(layer.match("/users")).toBe(false);
    expect(layer.match("/users/")).toBe(true);
  });

  test("应该正确处理sensitive选项", () => {
    const middleware = vi.fn();
    const layer = new Layer("/Users", ["GET"], middleware, { sensitive: true });
    
    expect(layer.match("/Users")).toBe(true);
    expect(layer.match("/users")).toBe(false);
  });

  test("应该正确处理end选项", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users", ["GET"], middleware, { end: false });
    
    expect(layer.match("/users/123")).toBe(true);
  });

  test("应该正确处理通配符路径", () => {
    const middleware = vi.fn();
    const layer = new Layer("/files/:splat*", ["GET"], middleware);
    
    expect(layer.match("/files/a/b/c")).toBe(true);
    
    const captures = layer.captures("/files/a/b/c");
    expect(captures).toEqual(["a/b/c"]);
  });

  test("应该正确处理可选参数", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users/:id?", ["GET"], middleware);
    
    expect(layer.match("/users")).toBe(true);
    expect(layer.match("/users/123")).toBe(true);
    
    const captures1 = layer.captures("/users");
    const captures2 = layer.captures("/users/123");
    
    expect(captures1).toEqual([undefined]);
    expect(captures2).toEqual(["123"]);
  });

  test("应该正确处理重复参数", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users/:ids*", ["GET"], middleware);
    
    expect(layer.match("/users/1/2/3")).toBe(true);
    
    const captures = layer.captures("/users/1/2/3");
    expect(captures).toEqual(["1/2/3"]);
  });

  test("应该正确处理自定义分隔符", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users-:id", ["GET"], middleware, { delimiter: "-" });
    
    expect(layer.match("/users-123")).toBe(true);
    
    const captures = layer.captures("/users-123");
    expect(captures).toEqual(["123"]);
  });

  test("应该正确处理URL编码的参数", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users/:name", ["GET"], middleware);
    
    const captures = layer.captures("/users/john%20doe");
    const params = layer.params("/users/john%20doe", captures);
    
    expect(params.name).toBe("john doe");
  });

  test("应该正确处理无效的URL编码", () => {
    const middleware = vi.fn();
    const layer = new Layer("/users/:name", ["GET"], middleware);
    
    const captures = layer.captures("/users/%E0%A4%B6");
    const params = layer.params("/users/%E0%A4%B6", captures);
    
    // 无效的URL编码应该返回原始值
    expect(params.name).toBe("श");
  });
});