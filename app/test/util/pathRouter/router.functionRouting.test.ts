import { describe, it, expect, beforeEach,test, vi } from "vitest";

import Router from "../../../src/util/pathRouter/core/router.htttpRouter";
import { InferContext, RequestBodyTypes } from "../../../src/util/pathRouter/core/types";
import { z } from "zod";

// 为测试定义一个具体的body schema
const testBodySchema = z.object({
  data: z.any().optional(),
  numbers: z.array(z.number()).optional(),
  shouldFail: z.boolean().optional(),
  calculationId: z.string().optional(),
  preferences: z.any().optional(),
  errorId: z.string().optional(),
  previousStep: z.string().optional(),
  chain: z.array(z.any()).optional(),
}).optional();

type TestBody = z.infer<typeof testBodySchema>

const testResponseBodySchema = z.object({
  step: z.string().optional(),
  data: z.any().optional(),
  nextStep: z.string().optional(),
  previousStep: z.string().optional(),
  chain: z.array(z.any()).optional(),
  completed: z.boolean().optional(),
  timestamp: z.number().optional(),
  source: z.string().optional(),
  processed: z.boolean().optional(),
  originalData: z.any().optional(),
  operation: z.string().optional(),
  input: z.array(z.number()).optional(),
  result: z.any().optional(),
  original: z.any().optional(),
  transformed: z.any().optional(),
  userId: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number(), z.boolean()]))]).optional(),
  preferences: z.any().optional(),
  lastUpdated: z.number().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
  success: z.boolean().optional(),
  error: z.string().optional(),
  handled: z.boolean().optional(),
  resolution: z.string().optional(),
}).optional();

// 使用泛型Context
type Context = InferContext<typeof testBodySchema, typeof testResponseBodySchema>

describe("函数路由测试 - 前端微应用模块间异步交互", () => {
  let router: Router;
  let eventBus: Map<string, any[]>;
  let moduleResponses: Map<string, any>;

  beforeEach(() => {
    router = new Router();
    eventBus = new Map();
    moduleResponses = new Map();
  });

  test("应该能够注册模块间函数路由", async () => {
    // 模块A注册一个处理函数
    router.post("/module/a/process", async (ctx: Context) => {
      const body = ctx.request.body; 
      const { data } = body || {};
      const result = {
        source: "moduleA",
        processed: true,
        originalData: data,
        timestamp: Date.now()
      };
      
      ctx.response.body = result;
      ctx.status = 200;
      
      // 模拟发布事件到其他模块
      eventBus.set("module.a.processed", [result]);
      return;
    });

    // 模块B注册一个处理函数
    router.post("/module/b/process", async (ctx: Context) => {
      const body = ctx.request.body;
      const { data } = body || {};
      const result = {
        source: "moduleB",
        processed: true,
        originalData: data,
        timestamp: Date.now()
      };
      
      ctx.response.body = result;
      ctx.status = 200;
      
      // 模拟发布事件到其他模块
      eventBus.set("module.b.processed", [result]);
      return;
    });

    // 验证路由已注册
    const matchA = router.match("/module/a/process", "POST");
    expect(matchA.pathAndMethod).toHaveLength(1);
    
    const matchB = router.match("/module/b/process", "POST");
    expect(matchB.pathAndMethod).toHaveLength(1);
  });

  test("应该能够处理模块间的异步通信", async () => {
    // 注册模块A的处理函数
    router.post("/module/a/calculate", async (ctx: Context) => {
      const body = ctx.request.body;
      const { numbers } = body || { numbers: [1, 2, 3] };
      const sum = numbers.reduce((acc: number, num: number) => acc + num, 0);
      
      const result = {
        operation: "sum",
        input: numbers,
        result: sum,
        source: "moduleA"
      };
      
      ctx.response.body = result;
      ctx.status = 200;
      
      // 存储结果供其他模块查询
      moduleResponses.set("calculation.result", result);
      return;
    });

    // 注册模块B的处理函数，它依赖于模块A的计算结果
    router.post("/module/b/transform", async (ctx: Context) => {
      const body = ctx.request.body;
      const { calculationId } = body || {};
      
      // 获取模块A的计算结果
      const calcResult = moduleResponses.get("calculation.result");
      if (!calcResult) {
        ctx.status = 404;
        ctx.response.body = { error: "Calculation result not found" };
        return;
      }
      
      // 对结果进行转换
      const transformed = {
        original: calcResult,
        transformed: calcResult.result * 2,
        source: "moduleB",
        timestamp: Date.now()
      };
      
      ctx.response.body = transformed;
      ctx.status = 200;
      return;
    });

    // 模拟模块A的计算请求
    const mockContextA: Context = {
      method: "POST" as const,
      path: "/module/a/calculate",
      host: "microapp.example.com",
      request: {
        method: "POST" as const,
        url: "/module/a/calculate",
        params: {},
        query: {},
        headers: { "content-type": "application/json" },
        body: { numbers: [5, 10, 15] }
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

    // 执行模块A的计算
    const dispatch = router.routes();
    await dispatch(mockContextA, async () => {});

    // 验证模块A的计算结果
    expect(mockContextA.response.body).toEqual({
      operation: "sum",
      input: [5, 10, 15],
      result: 30,
      source: "moduleA"
    });

    // 模拟模块B的转换请求
    const mockContextB: Context = {
      method: "POST" as const,
      path: "/module/b/transform",
      host: "microapp.example.com",
      request: {
        method: "POST" as const,
        url: "/module/b/transform",
        params: {},
        query: {},
        headers: { "content-type": "application/json" },
        body: { calculationId: "calculation.result" }
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

    // 执行模块B的转换
    const dispatchB = router.routes();
    await dispatchB(mockContextB, async () => {});

    // 验证模块B的转换结果
    expect(mockContextB.response.body).toEqual({
      original: {
        operation: "sum",
        input: [5, 10, 15],
        result: 30,
        source: "moduleA"
      },
      transformed: 60,
      source: "moduleB",
      timestamp: expect.any(Number)
    });
  });

  test("应该能够处理带参数的模块间路由", async () => {
    // 注册一个带参数的路由
    router.post("/module/user/:userId/profile", async (ctx: Context) => {
      const { userId } = ctx.params;
      const body = ctx.request.body;
      const { preferences } = body || {};
      
      const userProfile = {
        userId: String(userId),
        preferences,
        lastUpdated: Date.now(),
        source: "userModule"
      };
      
      ctx.response.body = userProfile;
      ctx.status = 200;
      
      // 发布用户配置更新事件
      eventBus.set("user.profile.updated", [userProfile]);
      return;
    });

    // 模拟请求
    const mockContext: Context = {
      method: "POST" as const,
      path: "/module/user/123/profile",
      host: "microapp.example.com",
      request: {
        method: "POST" as const,
        url: "/module/user/123/profile",
        params: { userId: "123" },
        query: {},
        headers: { "content-type": "application/json" },
        body: { preferences: { theme: "dark", language: "zh-CN" } }
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
      params: { userId: "123" },
      captures: ["123"],
      set: vi.fn(),
      redirect: vi.fn()
    };

    // 执行路由
    const dispatch = router.routes();
    await dispatch(mockContext, async () => {});

    // 验证结果
    expect(mockContext.response.body).toEqual({
      userId: "123",
      preferences: { theme: "dark", language: "zh-CN" },
      lastUpdated: expect.any(Number),
      source: "userModule"
    });

    // 验证事件已发布
    const events = eventBus.get("user.profile.updated");
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      userId: "123",
      preferences: { theme: "dark", language: "zh-CN" },
      lastUpdated: expect.any(Number),
      source: "userModule"
    });
  });

  test("应该能够处理模块间的错误传播", async () => {
    // 注册一个可能失败的处理函数
    router.post("/module/risky-operation", async (ctx: Context) => {
      const body = ctx.request.body;
      const { shouldFail } = body || {};
      
      if (shouldFail) {
        const error = {
          code: "OPERATION_FAILED",
          message: "The risky operation failed",
          source: "riskyModule",
          timestamp: Date.now()
        };
        
        ctx.status = 500;
        ctx.response.body = error;
        
        // 发布错误事件
        eventBus.set("operation.failed", [error]);
        return;
      }
      
      const result = {
        success: true,
        data: "Operation completed successfully",
        source: "riskyModule"
      };
      
      ctx.response.body = result;
      ctx.status = 200;
      return;
    });

    // 注册一个错误处理模块
    router.post("/module/error-handler", async (ctx: Context) => {
      const body = ctx.request.body;
      const { errorId } = body || {};
      
      // 获取错误事件
      const errors = eventBus.get("operation.failed") || [];
      const error = errors.find(e => e.code === errorId);
      
      if (!error) {
        ctx.status = 404;
        ctx.response.body = { error: "Error not found" };
        return;
      }
      
      const handledError = {
        original: error,
        handled: true,
        resolution: "Logged and notified user",
        source: "errorHandlerModule"
      };
      
      ctx.response.body = handledError;
      ctx.status = 200;
      return;
    });

    // 模拟失败的请求
    const mockFailContext: Context = {
      method: "POST" as const,
      path: "/module/risky-operation",
      host: "microapp.example.com",
      request: {
        method: "POST" as const,
        url: "/module/risky-operation",
        params: {},
        query: {},
        headers: { "content-type": "application/json" },
        body: { shouldFail: true }
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

    // 执行失败的操作
    const dispatchFail = router.routes();
    await dispatchFail(mockFailContext, async () => {});

    // 验证错误响应
    expect(mockFailContext.status).toBe(500);
    expect(mockFailContext.response.body).toEqual({
      code: "OPERATION_FAILED",
      message: "The risky operation failed",
      source: "riskyModule",
      timestamp: expect.any(Number)
    });

    // 验证错误事件已发布
    const errors = eventBus.get("operation.failed");
    expect(errors).toHaveLength(1);

    // 模拟错误处理请求
    const mockHandleContext: Context = {
      method: "POST" as const,
      path: "/module/error-handler",
      host: "microapp.example.com",
      request: {
        method: "POST" as const,
        url: "/module/error-handler",
        params: {},
        query: {},
        headers: { "content-type": "application/json" },
        body: { errorId: "OPERATION_FAILED" }
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

    // 执行错误处理
    const dispatchHandle = router.routes();
    await dispatchHandle(mockHandleContext, async () => {});

    // 验证错误处理结果
    expect(mockHandleContext.response.body).toEqual({
      original: {
        code: "OPERATION_FAILED",
        message: "The risky operation failed",
        source: "riskyModule",
        timestamp: expect.any(Number)
      },
      handled: true,
      resolution: "Logged and notified user",
      source: "errorHandlerModule"
    });
  });

  test("应该能够支持模块间的链式调用", async () => {
    // 注册模块A的处理函数
    router.post("/module/a/start", async (ctx: Context) => {
      const body = ctx.request.body;
      const { data } = body || {};
      
      const result = {
        step: "A",
        data: data,
        nextStep: "module/b/process",
        timestamp: Date.now()
      };
      
      ctx.response.body = result;
      ctx.status = 200;
      return;
    });

    // 注册模块B的处理函数
    router.post("/module/b/process", async (ctx: Context) => {
      const body = ctx.request.body;
      const { data, previousStep } = body || {};
      
      const result = {
        step: "B",
        data: data,
        previousStep: previousStep,
        nextStep: "module/c/complete",
        timestamp: Date.now()
      };
      
      ctx.response.body = result;
      ctx.status = 200;
      return;
    });

    // 注册模块C的完成函数
    router.post("/module/c/complete", async (ctx: Context) => {
      const body = ctx.request.body;
      const { data, chain } = body || {};
      
      const result = {
        step: "C",
        data: data,
        chain: chain,
        completed: true,
        timestamp: Date.now()
      };
      
      ctx.response.body = result;
      ctx.status = 200;
      return;
    });

    // 链式调用执行器
    const executeChain = async (initialContext: Context) => {
      let currentContext = initialContext;
      const chain: any[] = [];
      const dispatch = router.routes();

      // 先执行初始调用
      await dispatch(currentContext, async () => {});
      
      let previousResult = currentContext.response.body;

      // 循环执行后续调用
      while (previousResult && previousResult.nextStep) {
        chain.push(previousResult);

        const nextStepPath = previousResult.nextStep;
        
        const nextBody: TestBody = {
            data: previousResult.data,
            previousStep: previousResult.step,
        };

        // 最后一个请求需要 chain
        if (nextStepPath === "module/c/complete") {
            nextBody.chain = chain;
        }

        const nextContext: Context = {
          method: "POST" as const,
          path: `/${nextStepPath}`,
          host: "microapp.example.com",
          request: {
            method: "POST" as const,
            url: `/${nextStepPath}`,
            params: {},
            query: {},
            headers: { "content-type": "application/json" },
            body: nextBody,
          },
          response: { status: 200, headers: {}, body: undefined, set: vi.fn(), redirect: vi.fn() },
          status: 200,
          body: undefined,
          params: {},
          captures: [],
          set: vi.fn(),
          redirect: vi.fn()
        };

        await dispatch(nextContext, async () => {});
        currentContext = nextContext;
        previousResult = currentContext.response.body;
      }

      return currentContext.response.body;
    };

    // 模拟链式调用
    const initialData = { message: "Chain start" };
    const initialContext: Context = {
      method: "POST" as const,
      path: "/module/a/start",
      host: "microapp.example.com",
      request: {
        method: "POST" as const,
        url: "/module/a/start",
        params: {},
        query: {},
        headers: { "content-type": "application/json" },
        body: { data: initialData }
      },
      response: { status: 200, headers: {}, body: undefined, set: vi.fn(), redirect: vi.fn() },
      status: 200,
      body: undefined,
      params: {},
      captures: [],
      set: vi.fn(),
      redirect: vi.fn()
    };

    const finalResult = await executeChain(initialContext);

    // 验证链式调用结果
    expect(finalResult).toEqual({
      step: "C",
      data: initialData,
      chain: [
        {
          step: "A",
          data: initialData,
          nextStep: "module/b/process",
          timestamp: expect.any(Number)
        },
        {
          step: "B",
          data: initialData,
          previousStep: "A",
          nextStep: "module/c/complete",
          timestamp: expect.any(Number)
        }
      ],
      completed: true,
      timestamp: expect.any(Number)
    });
  });
});