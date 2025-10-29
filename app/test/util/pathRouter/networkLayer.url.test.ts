import NetworkLayer from '../../../src/util/pathRouter/core/networkLayer';

describe('NetworkLayer - URL生成测试', () => {
  test('应该生成基本URL', () => {
    const layer = new NetworkLayer('/users/:id', ['GET'], () => {});
    const url = layer.url({ id: '123' });
    expect(url).toBe('/users/123');
  });

  test('应该支持查询参数', () => {
    const layer = new NetworkLayer('/users/:id', ['GET'], () => {});
    const url = layer.url({ id: '123' }, { query: 'name=test&age=25' });
    expect(url).toBe('/users/123?name=test&age=25');
  });

  test('应该支持对象形式的查询参数', () => {
    const layer = new NetworkLayer('/users/:id', ['GET'], () => {});
    const url = layer.url({ id: '123' }, { query: { name: 'test', age: '25' } });
    expect(url).toBe('/users/123?name=test&age=25');
  });

  test('应该支持自定义URL解码器', () => {
    const customDecoder = (text: string) => text.replace(/%20/g, '+');
    const layer = new NetworkLayer('/search/:query', ['GET'], () => {}, {
      urlDecoder: customDecoder
    });
    
    const url = layer.url({ query: 'hello+world' });
    expect(url).toBe('/search/hello+world');
  });

  test('应该支持自定义URL查询处理器', () => {
    const customQueryHandler = (path: string, query?: string | Record<string, any>) => {
      if (typeof query === 'string') {
        return `${path}?custom=${query}`;
      }
      return `${path}?custom=${JSON.stringify(query)}`;
    };
    
    const layer = new NetworkLayer('/users/:id', ['GET'], () => {}, {
      urlQueryHandler: customQueryHandler
    });
    
    const url1 = layer.url({ id: '123' }, { query: 'test' });
    const url2 = layer.url({ id: '123' }, { query: { name: 'test' } });
    
    expect(url1).toBe('/users/123?custom=test');
    expect(url2).toBe('/users/123?custom={"name":"test"}');
  });
});