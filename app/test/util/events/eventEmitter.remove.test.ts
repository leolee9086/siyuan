import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";
import { SafeEventEmitter } from "../../../src/util/lib/events/eventEmitter";

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

describe("SafeEventEmitter - 事件监听器移除测试", () => {
  let emitter: SafeEventEmitter<typeof testEventDefines>;

  beforeEach(() => {
    emitter = new SafeEventEmitter(testEventDefines);
  });

  it("应该能够移除特定的事件监听器", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    
    emitter.on("userLogin", listener1);
    emitter.on("userLogin", listener2);
    
    expect(emitter.listenerCount("userLogin")).toBe(2);
    
    // 移除第一个监听器
    emitter.off("userLogin", listener1);
    
    expect(emitter.listenerCount("userLogin")).toBe(1);
    
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    emitter.emit("userLogin", userData);
    
    // 只有listener2应该被调用
    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledWith(userData);
  });

  it("移除不存在的监听器不应该出错", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    
    emitter.on("userLogin", listener1);
    
    // 尝试移除不存在的监听器
    expect(() => {
      emitter.off("userLogin", listener2);
    }).not.toThrow();
    
    expect(emitter.listenerCount("userLogin")).toBe(1);
  });

  it("移除不存在事件的监听器不应该出错", () => {
    const listener = vi.fn();
    
    // 尝试移除不存在事件的监听器
    expect(() => {
      emitter.off("nonExistentEvent" as any, listener);
    }).not.toThrow();
  });

  it("应该支持链式调用移除监听器", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    
    emitter.on("userLogin", listener1);
    emitter.on("messageReceived", listener2);
    
    const result = emitter
      .off("userLogin", listener1)
      .off("messageReceived", listener2);
    
    expect(result).toBe(emitter);
    expect(emitter.listenerCount("userLogin")).toBe(0);
    expect(emitter.listenerCount("messageReceived")).toBe(0);
  });

  it("应该能够移除一次性监听器", () => {
    const listener = vi.fn();
    
    emitter.once("userLogin", listener);
    
    expect(emitter.listenerCount("userLogin")).toBe(1);
    
    // 手动移除一次性监听器
    emitter.off("userLogin", listener);
    
    expect(emitter.listenerCount("userLogin")).toBe(0);
    
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    emitter.emit("userLogin", userData);
    
    // 监听器不应该被调用
    expect(listener).not.toHaveBeenCalled();
  });

  it("应该能够移除多个相同的监听器", () => {
    const listener = vi.fn();
    
    // 添加相同的监听器多次
    emitter.on("userLogin", listener);
    emitter.on("userLogin", listener);
    emitter.on("userLogin", listener);
    
    expect(emitter.listenerCount("userLogin")).toBe(3);
    
    // 移除一次应该只移除一个
    emitter.off("userLogin", listener);
    
    expect(emitter.listenerCount("userLogin")).toBe(2);
    
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    emitter.emit("userLogin", userData);
    
    // 剩余的两个监听器应该被调用
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("应该能够移除所有监听器", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const listener3 = vi.fn();
    
    emitter.on("userLogin", listener1);
    emitter.on("userLogin", listener2);
    emitter.on("messageReceived", listener3);
    
    expect(emitter.listenerCount("userLogin")).toBe(2);
    expect(emitter.listenerCount("messageReceived")).toBe(1);
    
    // 移除所有监听器
    emitter.removeAllListeners();
    
    expect(emitter.listenerCount("userLogin")).toBe(0);
    expect(emitter.listenerCount("messageReceived")).toBe(0);
    expect(emitter.eventNames()).toHaveLength(0);
  });

  it("应该能够移除特定事件的所有监听器", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const listener3 = vi.fn();
    
    emitter.on("userLogin", listener1);
    emitter.on("userLogin", listener2);
    emitter.on("messageReceived", listener3);
    
    expect(emitter.listenerCount("userLogin")).toBe(2);
    expect(emitter.listenerCount("messageReceived")).toBe(1);
    
    // 只移除userLogin事件的所有监听器
    emitter.removeAllListeners("userLogin");
    
    expect(emitter.listenerCount("userLogin")).toBe(0);
    expect(emitter.listenerCount("messageReceived")).toBe(1);
    
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    const messageData = {
      messageId: "msg123",
      content: "Hello",
      sender: "user1",
    };
    
    emitter.emit("userLogin", userData);
    emitter.emit("messageReceived", messageData);
    
    // userLogin的监听器不应该被调用
    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
    
    // messageReceived的监听器应该被调用
    expect(listener3).toHaveBeenCalledWith(messageData);
  });

  it("移除监听器后应该返回true", () => {
    const listener = vi.fn();
    
    emitter.on("userLogin", listener);
    
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    // 有监听器时应该返回true
    expect(emitter.emit("userLogin", userData)).toBe(true);
    
    // 移除监听器
    emitter.off("userLogin", listener);
    
    // 没有监听器时应该返回false
    expect(emitter.emit("userLogin", userData)).toBe(false);
  });

  it("应该能够正确处理混合的监听器移除", () => {
    const regularListener1 = vi.fn();
    const regularListener2 = vi.fn();
    const onceListener = vi.fn();
    
    emitter.on("userLogin", regularListener1);
    emitter.on("userLogin", regularListener2);
    emitter.once("userLogin", onceListener);
    
    expect(emitter.listenerCount("userLogin")).toBe(3);
    
    // 移除一个普通监听器
    emitter.off("userLogin", regularListener1);
    
    expect(emitter.listenerCount("userLogin")).toBe(2);
    
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    emitter.emit("userLogin", userData);
    
    // regularListener1不应该被调用
    expect(regularListener1).not.toHaveBeenCalled();
    
    // regularListener2和onceListener应该被调用
    expect(regularListener2).toHaveBeenCalledWith(userData);
    expect(onceListener).toHaveBeenCalledWith(userData);
    
    // 一次性监听器应该被自动移除
    expect(emitter.listenerCount("userLogin")).toBe(1);
  });

  it("应该支持链式调用移除所有监听器", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    
    emitter.on("userLogin", listener1);
    emitter.on("messageReceived", listener2);
    
    const result = emitter.removeAllListeners("userLogin").removeAllListeners("messageReceived");
    
    expect(result).toBe(emitter);
    expect(emitter.listenerCount("userLogin")).toBe(0);
    expect(emitter.listenerCount("messageReceived")).toBe(0);
  });
});
