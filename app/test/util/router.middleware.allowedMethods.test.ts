import Router from '../../src/util/router/router'
import type { Context } from '../../src/util/router/types'

describe('Router allowedMethods测试', () => {
  let mockContext: Context

  beforeEach(() => {
    mockContext = {
      method: 'GET',
      path: '/users/123',
      host: 'example.com',
      request: {
        method: 'GET',
        url: '/users/123',
        params: {},
        query: {},
        headers: {}
      },
      response: {
        status: 200,
        headers: {},
        set: jest.fn(),
        redirect: jest.fn()
      },
      status: 200,
      params: {},
      captures: [],
      set: jest.fn(),
      redirect: jest.fn()
    }
  })

  test('应该正确处理allowedMethods中间件', async () => {
    const router = new Router()
    const middleware = jest.fn()
    
    router.get('/users/:id', middleware)
    router.post('/users/:id', middleware)
    
    const allowedMethods = router.allowedMethods()
    
    mockContext.method = 'OPTIONS'
    // 修复：确保matched属性存在并且包含路由层
    mockContext.matched = [router.stack[0]]
    
    await allowedMethods(mockContext, jest.fn())
    
    expect(mockContext.status).toBe(200)
    expect(mockContext.set).toHaveBeenCalledWith('Allow', 'GET,POST,HEAD')
  })
})