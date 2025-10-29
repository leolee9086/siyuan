import Router from '../../src/util/router/core/router'
import type { Context, MiddlewareFunction } from '../../src/util/router/core/types'

describe('Router嵌套路由测试', () => {
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

  test('应该正确处理嵌套路由', async () => {
    const router = new Router()
    const nestedRouter = new Router()
    
    const parentMiddleware = jest.fn((ctx, next) => {
      ctx.body = 'Parent'
      return next()
    })
    
    const childMiddleware = jest.fn((ctx, next) => {
      ctx.body += ' -> Child'
      return next()
    })
    
    router.use('/api', parentMiddleware)
    nestedRouter.get('/users/:id', childMiddleware)
    router.use('/api', nestedRouter.routes() )
    
    mockContext.path = '/api/users/123'
    
    const dispatch = router.routes()
    await dispatch(mockContext, jest.fn())
    
    expect(parentMiddleware).toHaveBeenCalled()
    expect(childMiddleware).toHaveBeenCalled()
    expect(mockContext.body).toBe('Parent -> Child')
  })
})