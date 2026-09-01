import { z } from "zod";
import { describe, it, expect, beforeEach,test, vi } from "vitest";

import Router from "../../../src/util/pathRouter/core/router.htttpRouter";
import { chain } from "../../../src/util/pathRouter/core/router.execution";
import { Context } from "../../../src/util/pathRouter/core/types";

describe("router execution", () => {
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

  it("should execute a multi-step chain correctly", async () => {
    const requestSchema = z.object({
      start: z.string(),
      message: z.string().optional(),
    });

    const responseSchema = z.object({
      message: z.string(),
    }).passthrough(); // 允许额外字段，如 finalData

    const { router,execute } = chain(requestSchema, responseSchema);

    // 第一个处理器匹配 /module 路径
    router.use("/module", async (ctx, next) => {
      const { start } = ctx.request.body;
      ctx.response.body = {
        message: "Step 1 received: " + start,
      };
      ctx.history?.push({ step: "step1", data: ctx.response.body });
      await next();
    });

    // 第二个处理器匹配 /module/a/start 路径，更精确的匹配
    router.post("/module/a/start", async (ctx, next) => {
      const { message } = ctx.request.body;
      const prevMessage = ctx.response.body.message;
      ctx.response.body = {
        message: "Step 2 received: " + (message || prevMessage || "No message")
      };
      ctx.history?.push({ step: "step2", data: ctx.response.body });
      await next();
    });

    const initialContext: Context<typeof requestSchema, typeof responseSchema> = {
      method: "POST" as const,
      path: "/module/a/start",
      host: "test.com",
      request: {
        method: "POST" as const,
        url: "/module/a/start",
        headers: { "content-type": "application/json" },
        params: {},
        query: {},
        body: {
          start: "Initial call",
        },
      },
      response: {
        status: 200,
        headers: {},
        set: vi.fn(),
        redirect: vi.fn(),
        body: {
          message: "",
        },
      },
      status: 200,
      body: undefined,
      params: {},
      captures: [],
      set: vi.fn(),
      redirect: vi.fn(),
    };

    const finalContext = await execute(initialContext);

    // 验证历史记录
    expect(finalContext.response.body).toEqual({
      message: "Step 2 received: Step 1 received: Initial call",
    });
    
    // 验证历史记录长度
    const history = finalContext.history || [];
    expect(history.length).toBe(2);
    expect(history[0]).toEqual({
      step: "step1",
      data: { message: "Step 1 received: Initial call" }
    });
    expect(history[1]).toEqual({
      step: "step2",
      data: { message: "Step 2 received: Step 1 received: Initial call" }
    });
  });
});
