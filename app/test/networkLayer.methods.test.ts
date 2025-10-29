import NetworkLayer from '../src/util/router/core/networkLayer';

describe('NetworkLayer - HTTP方法测试', () => {
  test('应该正确处理HTTP方法', () => {
    const layer = new NetworkLayer('/users', ['GET', 'POST'], () => {});
    expect(layer.getSupportedMethods()).toContain('GET');
    expect(layer.getSupportedMethods()).toContain('POST');
    expect(layer.getSupportedMethods()).toContain('HEAD'); // GET应该自动添加HEAD
  });

  test('应该支持方法检查', () => {
    const layer = new NetworkLayer('/users', ['GET', 'POST'], () => {});
    expect(layer.supportsMethod('GET')).toBe(true);
    expect(layer.supportsMethod('POST')).toBe(true);
    expect(layer.supportsMethod('PUT')).toBe(false);
    expect(layer.supportsMethod('get')).toBe(true); // 应该不区分大小写
  });

  test('应该去重方法', () => {
    const layer = new NetworkLayer('/users', ['GET', 'GET', 'POST'], () => {});
    const methods = layer.getSupportedMethods();
    const getMethods = methods.filter(m => m === 'GET');
    expect(getMethods.length).toBe(1);
  });

  test('应该自动添加HEAD方法', () => {
    const layer1 = new NetworkLayer('/users', ['GET'], () => {});
    const layer2 = new NetworkLayer('/users', ['POST'], () => {});
    
    expect(layer1.getSupportedMethods()).toContain('HEAD');
    expect(layer2.getSupportedMethods()).not.toContain('HEAD');
  });
});