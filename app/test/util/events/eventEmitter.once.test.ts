import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { SafeEventEmitter } from '../../../src/util/events/eventEmitter';

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
  systemShutdown: {
    reason: z.string(),
    timestamp: z.number(),
  },
} as const;

describe('SafeEventEmitter - 一次性事件监听测试', () => {
  let emitter: SafeEventEmitter<typeof testEventDefines>;

  beforeEach(() => {
    emitter = new SafeEventEmitter(testEventDefines);
  });

  it('应该能够添加一次性事件监听器', () => {
    const listener = vi.fn();
    emitter.once('userLogin', listener);
    
    expect(emitter.listenerCount('userLogin')).toBe(1);
  });

  it('一次性监听器应该只被调用一次', () => {
    const listener = vi.fn();
    emitter.once('userLogin', listener);
    
    const userData = {
      userId: 'user123',
      username: 'testuser',
      timestamp: Date.now(),
    };
    
    // 第一次触发
    emitter.emit('userLogin', userData);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(userData);
    
    // 第二次触发
    emitter.emit('userLogin', userData);
    expect(listener).toHaveBeenCalledTimes(1); // 仍然只被调用一次
  });

  it('一次性监听器被调用后应该自动移除', () => {
    const listener = vi.fn();
    emitter.once('userLogin', listener);
    
    const userData = {
      userId: 'user123',
      username: 'testuser',
      timestamp: Date.now(),
    };
    
    // 触发事件
    emitter.emit('userLogin', userData);
    
    // 检查监听器是否被自动移除
    expect(emitter.listenerCount('userLogin')).toBe(0);
  });

  it('应该支持多个一次性监听器监听同一事件', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    
    emitter.once('userLogin', listener1);
    emitter.once('userLogin', listener2);
    
    const userData = {
      userId: 'user123',
      username: 'testuser',
      timestamp: Date.now(),
    };
    
    emitter.emit('userLogin', userData);
    
    expect(listener1).toHaveBeenCalledWith(userData);
    expect(listener2).toHaveBeenCalledWith(userData);
    expect(emitter.listenerCount('userLogin')).toBe(0);
  });

  it('应该支持混合使用普通监听器和一次性监听器', () => {
    const regularListener = vi.fn();
    const onceListener = vi.fn();
    
    emitter.on('userLogin', regularListener);
    emitter.once('userLogin', onceListener);
    
    const userData = {
      userId: 'user123',
      username: 'testuser',
      timestamp: Date.now(),
    };
    
    // 第一次触发
    emitter.emit('userLogin', userData);
    expect(regularListener).toHaveBeenCalledTimes(1);
    expect(onceListener).toHaveBeenCalledTimes(1);
    expect(emitter.listenerCount('userLogin')).toBe(1); // 只有普通监听器还在
    
    // 第二次触发
    emitter.emit('userLogin', userData);
    expect(regularListener).toHaveBeenCalledTimes(2);
    expect(onceListener).toHaveBeenCalledTimes(1); // 一次性监听器仍然只被调用一次
    expect(emitter.listenerCount('userLogin')).toBe(1);
  });

  it('一次性监听器应该支持链式调用', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    
    const result = emitter
      .once('userLogin', listener1)
      .once('messageReceived', listener2);
    
    expect(result).toBe(emitter);
    expect(emitter.listenerCount('userLogin')).toBe(1);
    expect(emitter.listenerCount('messageReceived')).toBe(1);
  });

  it('一次性监听器在触发时应该返回true', () => {
    const listener = vi.fn();
    emitter.once('userLogin', listener);
    
    const userData = {
      userId: 'user123',
      username: 'testuser',
      timestamp: Date.now(),
    };
    
    const result = emitter.emit('userLogin', userData);
    expect(result).toBe(true);
  });

  it('一次性监听器被移除后再次触发应该返回false', () => {
    const listener = vi.fn();
    emitter.once('userLogin', listener);
    
    const userData = {
      userId: 'user123',
      username: 'testuser',
      timestamp: Date.now(),
    };
    
    // 第一次触发
    emitter.emit('userLogin', userData);
    
    // 第二次触发，应该返回false因为没有监听器了
    const result = emitter.emit('userLogin', userData);
    expect(result).toBe(false);
  });

  it('应该能够手动移除一次性监听器', () => {
    const listener = vi.fn();
    emitter.once('userLogin', listener);
    
    // 手动移除监听器
    emitter.off('userLogin', listener);
    
    const userData = {
      userId: 'user123',
      username: 'testuser',
      timestamp: Date.now(),
    };
    
    // 触发事件，监听器不应该被调用
    emitter.emit('userLogin', userData);
    expect(listener).not.toHaveBeenCalled();
  });

  it('一次性监听器抛出错误不应该影响其他监听器', () => {
    const errorListener = vi.fn(() => {
      throw new Error('Test error');
    });
    const normalListener = vi.fn();
    
    emitter.once('userLogin', errorListener);
    emitter.on('userLogin', normalListener);
    
    const userData = {
      userId: 'user123',
      username: 'testuser',
      timestamp: Date.now(),
    };
    
    // 触发事件，不应该抛出错误
    expect(() => {
      emitter.emit('userLogin', userData);
    }).not.toThrow();
    
    // 正常监听器应该被调用
    expect(normalListener).toHaveBeenCalledWith(userData);
    
    // 一次性监听器应该被移除
    expect(emitter.listenerCount('userLogin')).toBe(1);
  });
});