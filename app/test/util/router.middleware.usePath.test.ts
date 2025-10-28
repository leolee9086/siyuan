import Router from '../../src/util/router/router'
import type { Context } from '../../src/util/router/types'

describe('Router路径相关use方法测试', () => {
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

  test('应该正确处理带路径的use方法', async () => {
    const router = new Router()
    const pathMiddleware = jest.fn((ctx, next) => {
      ctx.body = 'Path'
      return next()
    })
    const routeMiddleware = jest.fn((ctx, next) => {
      ctx.body += ' -> Route'
      return next()
    })
    
    router.use('/api', pathMiddleware)
    router.get('/api/users/:id', routeMiddleware)
    
    mockContext.path = '/api/users/123'
    
    const dispatch = router.routes()
    
    await dispatch(mockContext, jest.fn())
    
    expect(pathMiddleware).toHaveBeenCalled()
    expect(routeMiddleware).toHaveBeenCalled()
    expect(mockContext.body).toBe('Path -> Route')
  })

  test('应该正确处理数组路径的use方法', async () => {
    const router = new Router()
    const pathMiddleware = jest.fn((ctx, next) => {
      ctx.body = 'Path'
      return next()
    })
    const routeMiddleware = jest.fn((ctx, next) => {
      ctx.body += ' -> Route'
      return next()
    })
    
    router.use(['/api', '/v1'], pathMiddleware)
    router.get('/api/users/:id', routeMiddleware)
    
    mockContext.path = '/api/users/123'
    
    const dispatch = router.routes()
    
    await dispatch(mockContext, jest.fn())
    
    expect(pathMiddleware).toHaveBeenCalled()
    expect(routeMiddleware).toHaveBeenCalled()
    expect(mockContext.body).toBe('Path -> Route')
  })
})