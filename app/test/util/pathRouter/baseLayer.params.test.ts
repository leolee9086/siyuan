import { describe, it, expect, beforeEach,test } from 'vitest';

import BaseLayer from '../../../src/util/pathRouter/core/baseLayer';

describe('BaseLayer - 参数提取测试', () => {
  test('应该正确提取路径参数', () => {
    const layer = new BaseLayer('/users/:id', () => {});
    const captures = layer.captures('/users/123');
    const params = layer.params('/users/123', captures);
    
    expect(params).toEqual({ id: '123' });
  });

  test('应该正确提取多个路径参数', () => {
    const layer = new BaseLayer('/users/:userId/posts/:postId', () => {});
    const captures = layer.captures('/users/123/posts/456');
    const params = layer.params('/users/123/posts/456', captures);
    
    expect(params).toEqual({ userId: '123', postId: '456' });
  });

  test('应该正确处理URL编码的参数', () => {
    const layer = new BaseLayer('/search/:query', () => {});
    const captures = layer.captures('/search/hello%20world');
    const params = layer.params('/search/hello%20world', captures);
    
    expect(params).toEqual({ query: 'hello world' });
  });

  test('应该正确处理空参数', () => {
    const layer = new BaseLayer('/users/:id?', () => {});
    const captures = layer.captures('/users/');
    const params = layer.params('/users/', captures);
    
    expect(params).toEqual({});
  });

  test('应该支持自定义参数处理器', () => {
    const customProcessor = {
      decode: (text: string) => text.toUpperCase()
    };
    
    const layer = new BaseLayer('/users/:id', () => {});
    layer.setParameterProcessor(customProcessor);
    
    const captures = layer.captures('/users/abc');
    const params = layer.params('/users/abc', captures);
    
    expect(params).toEqual({ id: 'ABC' });
  });

  test('应该正确处理ignoreCaptures选项', () => {
    const layer1 = new BaseLayer('/users/:id', () => {}, { ignoreCaptures: false });
    const layer2 = new BaseLayer('/users/:id', () => {}, { ignoreCaptures: true });
    
    const captures1 = layer1.captures('/users/123');
    const captures2 = layer2.captures('/users/123');
    
    expect(captures1).toEqual(['123']);
    expect(captures2).toEqual([]);
  });
});