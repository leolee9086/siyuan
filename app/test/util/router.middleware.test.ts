import Router from '../../src/util/router/router'
import type { Context } from '../../src/util/router/types'

describe('Router中间件测试', () => {
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

  test('应该正确执行单个中间件', async () => {
    const router = new Router()
    const middleware = jest.fn((ctx, next) => {
      ctx.body = 'Hello World'
      return next()
    })
    
    router.get('/users/:id', middleware)
    
    const dispatch = router.routes()
    
    await dispatch(mockContext, jest.fn())
    
    expect(middleware).toHaveBeenCalled()
    expect(mockContext.body).toBe('Hello World')
  })

  test('应该正确执行多个中间件', async () => {
    const router = new Router()
    const middleware1 = jest.fn((ctx, next) => {
      ctx.body = 'Step 1'
      return next()
    })
    const middleware2 = jest.fn((ctx, next) => {
      ctx.body += ' -> Step 2'
      return next()
    })
    const middleware3 = jest.fn((ctx, next) => {
      ctx.body += ' -> Step 3'
      return next()
    })
    
    router.get('/users/:id', middleware1, middleware2, middleware3)
    
    const dispatch = router.routes()
    
    await dispatch(mockContext, jest.fn())
    
    expect(middleware1).toHaveBeenCalled()
    expect(middleware2).toHaveBeenCalled()
    expect(middleware3).toHaveBeenCalled()
    expect(mockContext.body).toBe('Step 1 -> Step 2 -> Step 3')
  })

  test('应该正确处理use方法添加中间件', async () => {
    const router = new Router()
    const globalMiddleware = jest.fn((ctx, next) => {
      ctx.body = 'Global'
      return next()
    })
    const routeMiddleware = jest.fn((ctx, next) => {
      ctx.body += ' -> Route'
      return next()
    })
    
    router.use(globalMiddleware)
    router.get('/users/:id', routeMiddleware)
    
    const dispatch = router.routes()
    
    await dispatch(mockContext, jest.fn())
    
    expect(globalMiddleware).toHaveBeenCalled()
    expect(routeMiddleware).toHaveBeenCalled()
    expect(mockContext.body).toBe('Global -> Route')
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
    
    mockContext.path = '/api/users'
    
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
    
    mockContext.path = '/api/users'
    
    const dispatch = router.routes()
    
    await dispatch(mockContext, jest.fn())
    
    expect(pathMiddleware).toHaveBeenCalled()
    expect(routeMiddleware).toHaveBeenCalled()
    expect(mockContext.body).toBe('Path -> Route')
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
    router.use('/api', nestedRouter)
    
    mockContext.path = '/api/users'
    
    const dispatch = router.routes()
    
    await dispatch(mockContext, jest.fn())
    
    expect(parentMiddleware).toHaveBeenCalled()
    expect(childMiddleware).toHaveBeenCalled()
    expect(mockContext.body).toBe('Parent -> Child')
  })

  test('应该正确处理参数中间件', async () => {
    const router = new Router()
    const paramMiddleware = jest.fn((param, ctx, next) => {
      ctx.user = { id: param }
      return next()
    })
    const routeMiddleware = jest.fn((ctx, next) => {
      ctx.body = `User ID: ${ctx.user.id}`
      return next()
    })
    
    router.param('id', paramMiddleware)
    router.get('/users/:id', routeMiddleware)
    
    const dispatch = router.routes()
    
    await dispatch(mockContext, jest.fn())
    
    expect(paramMiddleware).toHaveBeenCalledWith('123', mockContext, expect.any(Function))
    expect(routeMiddleware).toHaveBeenCalled()
    expect(mockContext.body).toBe('User ID: 123')
  })

  test('应该正确处理中间件中的错误', async () => {
    const router = new Router()
    const error = new Error('Test error')
    const errorMiddleware = jest.fn((ctx, next) => {
      throw error
    })
    const catchMiddleware = jest.fn()
    
    router.get('/users/:id', errorMiddleware)
    
    const dispatch = router.routes()
    
    try {
      await dispatch(mockContext, jest.fn())
    } catch (e) {
      expect(e).toBe(error)
    }
    
    expect(errorMiddleware).toHaveBeenCalled()
  })

  test('应该正确处理中间件中的异步操作', async () => {
    const router = new Router()
    const asyncMiddleware = jest.fn(async (ctx, next) => {
      await new Promise(resolve => setTimeout(resolve, 10))
      ctx.body = 'Async'
      return next()
    })
    
    router.get('/users/:id', asyncMiddleware)
    
    const dispatch = router.routes()
    
    await dispatch(mockContext, jest.fn())
    
    expect(asyncMiddleware).toHaveBeenCalled()
    expect(mockContext.body).toBe('Async')
  })

  test('应该正确处理中间件链中的next调用', async () => {
    const router = new Router()
    const middleware1 = jest.fn((ctx, next) => {
      ctx.body = 'Step 1'
      return next()
    })
    const middleware2 = jest.fn((ctx, next) => {
      // 不调用next，中断中间件链
      ctx.body += ' -> Step 2 (end)'
    })
    const middleware3 = jest.fn((ctx, next) => {
      ctx.body += ' -> Step 3'
      return next()
    })
    
    router.get('/users/:id', middleware1, middleware2, middleware3)
    
    const dispatch = router.routes()
    
    await dispatch(mockContext, jest.fn())
    
    expect(middleware1).toHaveBeenCalled()
    expect(middleware2).toHaveBeenCalled()
    expect(middleware3).not.toHaveBeenCalled()
    expect(mockContext.body).toBe('Step 1 -> Step 2 (end)')
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

  test('应该正确处理不支持的HTTP方法', async () => {
    const router = new Router()
    const middleware = jest.fn()
    
    router.get('/users/:id', middleware)
    
    const allowedMethods = router.allowedMethods()
    
    mockContext.method = 'PATCH'
    // 修复：确保matched属性存在并且包含路由层
    mockContext.matched = [router.stack[0]]
    
    await allowedMethods(mockContext, jest.fn())
    
    expect(mockContext.status).toBe(405)
    expect(mockContext.set).toHaveBeenCalledWith('Allow', 'GET,HEAD')
  })

  test('应该正确处理未实现的HTTP方法', async () => {
    const router = new Router()
    const middleware = jest.fn()
    
    router.get('/users/:id', middleware)
    
    const allowedMethods = router.allowedMethods({ throw: true })
    
    mockContext.method = 'UNKNOWN'
    // 修复：确保matched属性存在并且包含路由层
    mockContext.matched = [router.stack[0]]
    
    try {
      await allowedMethods(mockContext, jest.fn())
      fail('Should have thrown an error')
    } catch (error) {
      expect(error.message).toBe('not implemented')
    }
  })
})