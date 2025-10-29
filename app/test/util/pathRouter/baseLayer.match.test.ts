import BaseLayer from '../../../src/util/pathRouter/core/baseLayer';

describe('BaseLayer - 路径匹配测试', () => {
  test('应该匹配简单路径', () => {
    const layer = new BaseLayer('/users', () => {});
    expect(layer.match('/users')).toBe(true);
    expect(layer.match('/users/123')).toBe(false);
  });

  test('应该匹配带参数的路径', () => {
    const layer = new BaseLayer('/users/:id', () => {});
    expect(layer.match('/users/123')).toBe(true);
    expect(layer.match('/users/abc')).toBe(true);
    expect(layer.match('/users')).toBe(false);
    expect(layer.match('/users/123/profile')).toBe(false);
  });

  test('应该匹配正则表达式路径', () => {
    const layer = new BaseLayer(/^\/users\/\d+$/, () => {});
    expect(layer.match('/users/123')).toBe(true);
    expect(layer.match('/users/abc')).toBe(false);
    expect(layer.match('/posts/123')).toBe(false);
  });

  test('应该支持end选项', () => {
    const layer1 = new BaseLayer('/users', () => {}, { end: true });
    const layer2 = new BaseLayer('/users', () => {}, { end: false });
    
    expect(layer1.match('/users')).toBe(true);
    expect(layer1.match('/users/123')).toBe(false);
    
    expect(layer2.match('/users')).toBe(true);
    expect(layer2.match('/users/123')).toBe(true);
  });

  test('应该支持sensitive选项', () => {
    const layer1 = new BaseLayer('/Users', () => {}, { sensitive: true });
    const layer2 = new BaseLayer('/Users', () => {}, { sensitive: false });
    
    expect(layer1.match('/Users')).toBe(true);
    expect(layer1.match('/users')).toBe(false);
    
    expect(layer2.match('/Users')).toBe(true);
    expect(layer2.match('/users')).toBe(true);
  });

  test('应该支持delimiter选项', () => {
    const layer = new BaseLayer('/users-:id', () => {}, { delimiter: '-' });
    expect(layer.match('/users-123')).toBe(true);
    expect(layer.match('/users/123')).toBe(false);
  });
});