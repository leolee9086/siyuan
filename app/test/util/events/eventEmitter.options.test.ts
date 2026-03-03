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

describe("SafeEventEmitter - 选项配置和错误处理测试", () => {
  let emitter: SafeEventEmitter<typeof testEventDefines>;

  beforeEach(() => {
    emitter = new SafeEventEmitter(testEventDefines);
  });

  it("应该使用默认选项创建事件发射器", () => {
    const defaultEmitter = new SafeEventEmitter(testEventDefines);
    
    // 添加一个监听器，否则emit会返回false
    const listener = vi.fn();
    defaultEmitter.on("userLogin", listener);
    
    // 默认情况下运行时验证应该是关闭的
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    // 应该成功触发，因为默认不进行验证
    expect(defaultEmitter.emit("userLogin", invalidData)).toBe(true);
    expect(listener).toHaveBeenCalledWith(invalidData);
  });

  it("应该支持自定义选项", () => {
    const customOptions = {
      runtimeCheck: true,
      validationFailure: "warn" as const,
      revalidateAfterEach: false,
    };
    
    const customEmitter = new SafeEventEmitter(testEventDefines, customOptions);
    
    // 验证选项是否被正确设置
    expect(customEmitter.emit("userLogin", {} as any)).toBe(false);
  });

  it("应该支持动态更新选项", () => {
    const listener = vi.fn();
    emitter.on("userLogin", listener);
    
    // 默认不验证
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    expect(emitter.emit("userLogin", invalidData)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    
    // 更新选项启用验证，同时设置为warn模式而不是默认的throw模式
    emitter.setOptions({ runtimeCheck: true, validationFailure: "warn" as const });
    
    // 现在应该返回false而不是抛出错误
    expect(emitter.emit("userLogin", invalidData)).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1); // 没有增加
  });

  it("应该支持部分更新选项", () => {
    const emitterWithOptions = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "throw" as const,
      revalidateAfterEach: true,
    });
    
    // 添加一个监听器，否则emit会直接返回false而不进行验证
    const listener = vi.fn();
    emitterWithOptions.on("userLogin", listener);
    
    // 部分更新选项
    emitterWithOptions.setOptions({ validationFailure: "warn" as const });
    
    // 验证其他选项是否保持不变
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    // 应该输出警告而不是抛出错误
    expect(emitterWithOptions.emit("userLogin", invalidData)).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it("应该支持链式调用更新选项", () => {
    const result = emitter
      .setOptions({ runtimeCheck: true })
      .setOptions({ validationFailure: "warn" as const });
    
    expect(result).toBe(emitter);
  });

  it("应该支持启用运行时验证", () => {
    const listener = vi.fn();
    emitter.on("userLogin", listener);
    
    // 启用验证，同时设置为warn模式而不是默认的throw模式
    emitter.setOptions({ runtimeCheck: true, validationFailure: "warn" as const });
    
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    expect(emitter.emit("userLogin", invalidData)).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it("应该支持禁用运行时验证", () => {
    const emitterWithValidation = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "silent" as const,
    });
    
    const listener = vi.fn();
    emitterWithValidation.on("userLogin", listener);
    
    // 禁用验证
    emitterWithValidation.disableRuntimeCheck();
    
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    expect(emitterWithValidation.emit("userLogin", invalidData)).toBe(true);
    expect(listener).toHaveBeenCalledWith(invalidData);
  });

  it("应该支持自定义验证错误处理", () => {
    const errorHandler = vi.fn();
    
    const emitterWithCustomHandler = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "silent" as const,
      onValidationError: errorHandler,
    });
    
    const listener = vi.fn();
    emitterWithCustomHandler.on("userLogin", listener);
    
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    emitterWithCustomHandler.emit("userLogin", invalidData);
    
    // 应该调用自定义错误处理器
    expect(errorHandler).toHaveBeenCalledWith(
      "userLogin",
      expect.any(z.ZodError),
      invalidData
    );
    
    // 监听器不应该被调用
    expect(listener).not.toHaveBeenCalled();
  });

  it("应该支持动态更新验证错误处理", () => {
    const errorHandler1 = vi.fn();
    const errorHandler2 = vi.fn();
    
    const emitter = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "silent" as const,
      onValidationError: errorHandler1,
    });
    
    // 更新错误处理器
    emitter.setOptions({ onValidationError: errorHandler2 });
    
    const listener = vi.fn();
    emitter.on("userLogin", listener);
    
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    emitter.emit("userLogin", invalidData);
    
    // 应该调用新的错误处理器
    expect(errorHandler1).not.toHaveBeenCalled();
    expect(errorHandler2).toHaveBeenCalledWith(
      "userLogin",
      expect.any(z.ZodError),
      invalidData
    );
  });

  it("应该支持验证失败时抛出错误", () => {
    const emitterWithThrow = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "throw" as const,
    });
    
    const listener = vi.fn();
    emitterWithThrow.on("userLogin", listener);
    
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    expect(() => {
      emitterWithThrow.emit("userLogin", invalidData);
    }).toThrow('Event data validation failed for "userLogin"');
    
    // 监听器不应该被调用
    expect(listener).not.toHaveBeenCalled();
  });

  it("应该支持验证失败时输出警告", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    
    const emitterWithWarn = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "warn" as const,
    });
    
    const listener = vi.fn();
    emitterWithWarn.on("userLogin", listener);
    
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    const result = emitterWithWarn.emit("userLogin", invalidData);
    
    // 应该返回false
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

  it("应该支持验证失败时静默处理", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    
    const emitterWithSilent = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "silent" as const,
    });
    
    const listener = vi.fn();
    emitterWithSilent.on("userLogin", listener);
    
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    const result = emitterWithSilent.emit("userLogin", invalidData);
    
    // 应该返回false
    expect(result).toBe(false);
    
    // 不应该输出警告
    expect(consoleSpy).not.toHaveBeenCalled();
    
    // 监听器不应该被调用
    expect(listener).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it("应该支持启用监听器执行后重新验证", () => {
    const emitterWithRevalidation = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "throw" as const,
      revalidateAfterEach: true,
    });
    
    const listener = vi.fn((data) => {
      // 修改数据，使其不符合schema
      (data as any).userId = 123;
    });
    
    emitterWithRevalidation.on("userLogin", listener);
    
    const validData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    // 应该抛出错误，因为监听器修改了数据
    expect(() => {
      emitterWithRevalidation.emit("userLogin", validData);
    }).toThrow();
  });

  it("应该支持禁用监听器执行后重新验证", () => {
    const emitterWithoutRevalidation = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "throw" as const,
      revalidateAfterEach: false,
    });
    
    const listener = vi.fn((data) => {
      // 修改数据，使其不符合schema
      (data as any).userId = 123;
    });
    
    emitterWithoutRevalidation.on("userLogin", listener);
    
    const validData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    // 应该成功，因为不重新验证
    expect(() => {
      emitterWithoutRevalidation.emit("userLogin", validData);
    }).not.toThrow();
    
    expect(listener).toHaveBeenCalled();
  });

  it("应该支持动态更新重新验证选项", () => {
    const emitter = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "throw" as const,
      revalidateAfterEach: true,
    });
    
    const listener = vi.fn((data) => {
      // 修改数据，使其不符合schema
      (data as any).userId = 123;
    });
    
    emitter.on("userLogin", listener);
    
    const validData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    // 应该抛出错误，因为启用了重新验证
    expect(() => {
      emitter.emit("userLogin", validData);
    }).toThrow();
    
    // 禁用重新验证
    emitter.setOptions({ revalidateAfterEach: false });
    
    // 现在应该成功
    expect(() => {
      emitter.emit("userLogin", validData);
    }).not.toThrow();
  });

  it("应该处理监听器中的错误", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    const errorListener = vi.fn(() => {
      throw new Error("Test error");
    });
    
    emitter.on("userLogin", errorListener);
    
    const userData = {
      userId: "user123",
      username: "testuser",
      timestamp: Date.now(),
    };
    
    // 应该不会抛出错误
    expect(() => {
      emitter.emit("userLogin", userData);
    }).not.toThrow();
    
    // 应该输出错误信息
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error in event listener for"),
      new Error("Test error")
    );
    
    consoleSpy.mockRestore();
  });

  it("应该使用默认的验证错误处理", () => {
    const emitterWithoutCustomHandler = new SafeEventEmitter(testEventDefines, {
      runtimeCheck: true,
      validationFailure: "warn" as const,
      // 不提供自定义错误处理器
    });
    
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    
    const listener = vi.fn();
    emitterWithoutCustomHandler.on("userLogin", listener);
    
    const invalidData = {
      userId: 123, // 应该是string
      username: "testuser",
      // 缺少timestamp字段
    } as any;
    
    emitterWithoutCustomHandler.emit("userLogin", invalidData);
    
    // 应该使用默认的错误处理
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Event data validation failed"),
      expect.any(Array)
    );
    
    consoleSpy.mockRestore();
  });
});
