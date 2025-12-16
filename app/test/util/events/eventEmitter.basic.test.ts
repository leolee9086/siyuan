import { describe, it, expect, beforeEach,vi } from "vitest";
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
} as const;

describe("SafeEventEmitter - 基本功能测试", () => {
  let emitter: SafeEventEmitter<typeof testEventDefines>;

  beforeEach(() => {
    emitter = new SafeEventEmitter(testEventDefines);
  });

  it("应该能够创建事件发射器实例", () => {
    expect(emitter).toBeInstanceOf(SafeEventEmitter);
  });

  it("应该能够添加事件监听器", () => {
    const listener = vi.fn();
    emitter.on("userLogin", listener);
    
    expect(emitter.listenerCount("userLogin")).toBe(1);
  });

  it("应该能够触发事件并调用监听器", () => {
    const listener = vi.fn();
    emitter.on("userLogin", listener);
    
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    emitter.emit("userLogin", userData);
    
    expect(listener).toHaveBeenCalledWith(userData);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("应该支持多个监听器监听同一事件", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    
    emitter.on("userLogin", listener1);
    emitter.on("userLogin", listener2);
    
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    emitter.emit("userLogin", userData);
    
    expect(listener1).toHaveBeenCalledWith(userData);
    expect(listener2).toHaveBeenCalledWith(userData);
  });

  it("应该能够获取事件名称列表", () => {
    emitter.on("userLogin", vi.fn());
    emitter.on("messageReceived", vi.fn());
    
    const eventNames = emitter.eventNames();
    
    expect(eventNames).toContain("userLogin");
    expect(eventNames).toContain("messageReceived");
    expect(eventNames).toHaveLength(2);
  });

  it("应该能够统计监听器数量", () => {
    expect(emitter.listenerCount("userLogin")).toBe(0);
    
    emitter.on("userLogin", vi.fn());
    expect(emitter.listenerCount("userLogin")).toBe(1);
    
    emitter.on("userLogin", vi.fn());
    expect(emitter.listenerCount("userLogin")).toBe(2);
  });

  it("当没有监听器时应该返回false", () => {
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    const result = emitter.emit("userLogin", userData);
    
    expect(result).toBe(false);
  });

  it("当有监听器时应该返回true", () => {
    emitter.on("userLogin", vi.fn());
    
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    const result = emitter.emit("userLogin", userData);
    
    expect(result).toBe(true);
  });

  it("应该支持链式调用", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    
    const result = emitter
      .on("userLogin", listener1)
      .on("messageReceived", listener2);
    
    expect(result).toBe(emitter);
    expect(emitter.listenerCount("userLogin")).toBe(1);
    expect(emitter.listenerCount("messageReceived")).toBe(1);
  });

  it("应该能够获取事件的schema", () => {
    const schema = emitter.getEventSchema("userLogin");
    
    expect(schema).toBeDefined();
    expect(schema).toBeInstanceOf(z.ZodObject);
  });

  it("当事件不存在时应该返回undefined", () => {
    const schema = emitter.getEventSchema("nonExistentEvent" as any);
    
    expect(schema).toBeUndefined();
  });
});