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
    priority: z.enum(["low", "medium", "high"]).default("medium"),
  },
  dataProcessing: {
    dataId: z.string(),
    payload: z.object({
      value: z.number(),
      label: z.string(),
    }),
  },
} as const;

describe("SafeEventEmitter - 运行时数据验证测试", () => {
  let emitter: SafeEventEmitter<typeof testEventDefines>;

  beforeEach(() => {
    emitter = new SafeEventEmitter(testEventDefines);
  });

  it("默认情况下应该不进行运行时验证", () => {
    const listener = vi.fn();
    emitter.on("userLogin", listener);
    
    // 传入不符合schema的数据
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    const result = emitter.emit("userLogin", invalidData);
    
    // 应该成功触发，因为默认不进行验证
    expect(result).toBe(true);
    expect(listener).toHaveBeenCalledWith(invalidData);
  });

  it("启用运行时验证后应该验证数据", () => {
    const emitterWithValidation = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "throw",
    });
    
    const listener = vi.fn();
    emitterWithValidation.on("userLogin", listener);
    
    // 传入不符合schema的数据
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    expect(() => {
      emitterWithValidation.emit("userLogin", invalidData);
    }).toThrow();
    
    // 监听器不应该被调用
    expect(listener).not.toHaveBeenCalled();
  });

  it("启用运行时验证后应该允许符合schema的数据", () => {
    const emitterWithValidation = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "throw",
    });
    
    const listener = vi.fn();
    emitterWithValidation.on("userLogin", listener);
    
    // 传入符合schema的数据
    const validData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    const result = emitterWithValidation.emit("userLogin", validData);
    
    expect(result).toBe(true);
    expect(listener).toHaveBeenCalledWith(validData);
  });

  it("验证失败时应该支持警告模式", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    
    const emitterWithValidation = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "warn",
    });
    
    const listener = vi.fn();
    emitterWithValidation.on("userLogin", listener);
    
    // 传入不符合schema的数据
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    const result = emitterWithValidation.emit("userLogin", invalidData);
    
    // 应该返回false，因为验证失败
    expect(result).toBe(false);
    
    // 应该输出警告
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Event data validation failed"),
      expect.any(Array)
    );
    
    // 监听器不应该被调用
    expect(listener).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it("验证失败时应该支持静默模式", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    
    const emitterWithValidation = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "silent",
    });
    
    const listener = vi.fn();
    emitterWithValidation.on("userLogin", listener);
    
    // 传入不符合schema的数据
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    const result = emitterWithValidation.emit("userLogin", invalidData);
    
    // 应该返回false，因为验证失败
    expect(result).toBe(false);
    
    // 不应该输出警告
    expect(consoleSpy).not.toHaveBeenCalled();
    
    // 监听器不应该被调用
    expect(listener).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it("应该支持自定义验证错误处理", () => {
    const errorHandler = vi.fn();
    
    const emitterWithValidation = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "silent",
      onValidationError: errorHandler,
    });
    
    const listener = vi.fn();
    emitterWithValidation.on("userLogin", listener);
    
    // 传入不符合schema的数据
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    emitterWithValidation.emit("userLogin", invalidData);
    
    // 应该调用自定义错误处理器
    expect(errorHandler).toHaveBeenCalledWith(
      "userLogin",
      expect.any(z.ZodError),
      invalidData
    );
    
    // 监听器不应该被调用
    expect(listener).not.toHaveBeenCalled();
  });

  it("应该支持动态启用运行时验证", () => {
    const listener = vi.fn();
    emitter.on("userLogin", listener);
    
    // 默认不验证
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    const result = emitter.emit("userLogin", invalidData);
    expect(result).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    
    // 启用验证
    emitter.enableRuntimeCheck();
    expect(
        ()=>{emitter.emit("userLogin", invalidData);}

    ).toThrow();

    expect(listener).toHaveBeenCalledTimes(1); // 没有增加
  });

  it("应该支持动态禁用运行时验证", () => {
    const emitterWithValidation = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "silent",
    });
    
    const listener = vi.fn();
    emitterWithValidation.on("userLogin", listener);
    
    // 启用验证时
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    let result = emitterWithValidation.emit("userLogin", invalidData);
    expect(result).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    
    // 禁用验证
    emitterWithValidation.disableRuntimeCheck();
    
    result = emitterWithValidation.emit("userLogin", invalidData);
    expect(result).toBe(true);
    expect(listener).toHaveBeenCalledWith(invalidData);
  });

  it("应该支持复杂对象验证", () => {
    const emitterWithValidation = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "throw",
    });
    
    const listener = vi.fn();
    emitterWithValidation.on("dataProcessing", listener);
    
    // 传入符合schema的复杂数据
    const validData = {
      dataId: "data123",
      payload: {
        value: 42,
        label: "test data",
      },
    };
    
    const result = emitterWithValidation.emit("dataProcessing", validData);
    
    expect(result).toBe(true);
    expect(listener).toHaveBeenCalledWith(validData);
  });

  it("应该拒绝不符合复杂对象schema的数据", () => {
    const emitterWithValidation = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "throw",
    });
    
    const listener = vi.fn();
    emitterWithValidation.on("dataProcessing", listener);
    
    // 传入不符合schema的复杂数据
    const invalidData = {
      dataId: "data123",
      payload: {
        value: "not a number", // 应该是number
        label: "test data",
      },
    } as any;
    
    expect(() => {
      emitterWithValidation.emit("dataProcessing", invalidData);
    }).toThrow();
    
    // 监听器不应该被调用
    expect(listener).not.toHaveBeenCalled();
  });

  it("应该支持默认值", () => {
    const emitterWithValidation = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "throw",
    });
    
    const listener = vi.fn();
    emitterWithValidation.on("messageReceived", listener);
    
    // 传入缺少priority字段的数据，应该使用默认值
    const dataWithoutPriority = {
      messageId: "msg123",
      content: "Hello",
      sender: "user1",
    } as any; // 使用as any绕过类型检查，因为我们要测试运行时验证
    
    const result = emitterWithValidation.emit("messageReceived", dataWithoutPriority);
    
    expect(result).toBe(true);
    expect(listener).toHaveBeenCalledWith({
      ...dataWithoutPriority,
      priority: "medium", // 应该添加默认值
    });
  });

  it("异步触发时也应该进行验证", async () => {
    const emitterWithValidation = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "throw",
    });
    
    const listener = vi.fn();
    emitterWithValidation.on("userLogin", listener);
    
    // 传入不符合schema的数据
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    await expect(emitterWithValidation.emitAsync("userLogin", invalidData)).rejects.toThrow();
    
    // 监听器不应该被调用
    expect(listener).not.toHaveBeenCalled();
  });

  it("应该支持在监听器执行后重新验证", () => {
    const emitterWithValidation = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "throw",
      revalidateAfterEach: true,
    });
    
    const listener = vi.fn((data) => {
      // 修改数据，使其不符合schema
      (data as any).userId = 123;
    });
    
    emitterWithValidation.on("userLogin", listener);
    
    const validData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    // 应该抛出错误，因为监听器修改了数据
    expect(() => {
      emitterWithValidation.emit("userLogin", validData);
    }).toThrow();
  });

  it("应该支持禁用监听器执行后重新验证", () => {
    const emitterWithValidation = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "throw",
      revalidateAfterEach: false,
    });
    
    const listener = vi.fn((data) => {
      // 修改数据，使其不符合schema
      (data as any).userId = 123;
    });
    
    emitterWithValidation.on("userLogin", listener);
    
    const validData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    // 应该成功，因为不重新验证
    expect(() => {
      emitterWithValidation.emit("userLogin", validData);
    }).not.toThrow();
    
    // 验证监听器被调用，但不关心具体参数值，因为监听器会修改数据
    expect(listener).toHaveBeenCalledTimes(1);
  });
});