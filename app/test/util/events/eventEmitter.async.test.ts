import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";
import { SafeEventEmitter } from "../../../src/util/events/eventEmitter";

// 定义测试用的事件类型
const testEventDefines = {
  userLogin: {
    userId: z.string(),
    username: z.string(),
    timestamp: z.number(),
  },
  messageReceived: {
    messageId: z.string(),
    content: z.string(),
    sender: z.string(),
  },
  dataProcessing: {
    dataId: z.string(),
    payload: z.any(),
  },
} as const;

describe("SafeEventEmitter - 异步事件触发测试", () => {
  let emitter: SafeEventEmitter<typeof testEventDefines>;

  beforeEach(() => {
    emitter = new SafeEventEmitter(testEventDefines);
  });

  it("应该能够异步触发事件", async () => {
    const listener = vi.fn();
    emitter.on("userLogin", listener);
    
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    const result = await emitter.emitAsync("userLogin", userData);
    
    expect(result).toBe(true);
    expect(listener).toHaveBeenCalledWith(userData);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("应该按顺序执行异步监听器", async () => {
    const callOrder: number[] = [];
    
    const listener1 = vi.fn(async () => {
      callOrder.push(1);
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    
    const listener2 = vi.fn(async () => {
      callOrder.push(2);
      await new Promise(resolve => setTimeout(resolve, 5));
    });
    
    const listener3 = vi.fn(() => {
      callOrder.push(3);
    });
    
    emitter.on("dataProcessing", listener1);
    emitter.on("dataProcessing", listener2);
    emitter.on("dataProcessing", listener3);
    
    const data = {
      dataId: "data123",
      payload: { test: "data" },
    };
    
    await emitter.emitAsync("dataProcessing", data);
    
    expect(callOrder).toEqual([1, 2, 3]);
    expect(listener1).toHaveBeenCalledWith(data);
    expect(listener2).toHaveBeenCalledWith(data);
    expect(listener3).toHaveBeenCalledWith(data);
  });

  it("异步触发时应该等待所有监听器完成", async () => {
    let listener1Completed = false;
    let listener2Completed = false;
    
    const listener1 = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      listener1Completed = true;
    });
    
    const listener2 = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      listener2Completed = true;
    });
    
    emitter.on("dataProcessing", listener1);
    emitter.on("dataProcessing", listener2);
    
    const data = {
      dataId: "data123",
      payload: { test: "data" },
    };
    
    await emitter.emitAsync("dataProcessing", data);
    
    expect(listener1Completed).toBe(true);
    expect(listener2Completed).toBe(true);
  });

  it("异步触发时没有监听器应该返回false", async () => {
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    const result = await emitter.emitAsync("userLogin", userData);
    
    expect(result).toBe(false);
  });

  it("异步触发时有监听器应该返回true", async () => {
    emitter.on("userLogin", vi.fn());
    
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    const result = await emitter.emitAsync("userLogin", userData);
    
    expect(result).toBe(true);
  });

  it("异步触发应该支持一次性监听器", async () => {
    const listener = vi.fn();
    emitter.once("userLogin", listener);
    
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    // 第一次触发
    await emitter.emitAsync("userLogin", userData);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(emitter.listenerCount("userLogin")).toBe(0);
    
    // 第二次触发
    const result = await emitter.emitAsync("userLogin", userData);
    expect(result).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("异步触发时监听器抛出错误不应该阻止其他监听器", async () => {
    const errorListener = vi.fn(() => {
      throw new Error("Test error");
    });
    const normalListener = vi.fn();
    
    emitter.on("userLogin", errorListener);
    emitter.on("userLogin", normalListener);
    
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    // 应该不会抛出错误
    await expect(emitter.emitAsync("userLogin", userData)).resolves.toBe(true);
    
    // 正常监听器应该被调用
    expect(normalListener).toHaveBeenCalledWith(userData);
  });

  it("异步触发应该支持混合使用普通监听器和一次性监听器", async () => {
    const regularListener = vi.fn();
    const onceListener = vi.fn();
    
    emitter.on("userLogin", regularListener);
    emitter.once("userLogin", onceListener);
    
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    // 第一次触发
    await emitter.emitAsync("userLogin", userData);
    expect(regularListener).toHaveBeenCalledTimes(1);
    expect(onceListener).toHaveBeenCalledTimes(1);
    expect(emitter.listenerCount("userLogin")).toBe(1); // 只有普通监听器还在
    
    // 第二次触发
    await emitter.emitAsync("userLogin", userData);
    expect(regularListener).toHaveBeenCalledTimes(2);
    expect(onceListener).toHaveBeenCalledTimes(1); // 一次性监听器仍然只被调用一次
  });

  it("异步触发应该支持多个异步监听器", async () => {
    const results: string[] = [];
    
    const asyncListener1 = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      results.push("listener1");
    });
    
    const asyncListener2 = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      results.push("listener2");
    });
    
    emitter.on("dataProcessing", asyncListener1);
    emitter.on("dataProcessing", asyncListener2);
    
    const data = {
      dataId: "data123",
      payload: { test: "data" },
    };
    
    await emitter.emitAsync("dataProcessing", data);
    
    expect(results).toEqual(["listener1", "listener2"]);
  });

  it("异步触发应该正确处理监听器中的Promise", async () => {
    const listener = vi.fn(async (data) => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(data.payload);
        }, 10);
      });
    });
    
    emitter.on("dataProcessing", listener);
    
    const data = {
      dataId: "data123",
      payload: { test: "data" },
    };
    
    await emitter.emitAsync("dataProcessing", data);
    
    expect(listener).toHaveBeenCalledWith(data);
  });
});