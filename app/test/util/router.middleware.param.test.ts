import Router from '../../src/util/router/core/router'
import type { Context } from '../../src/util/router/core/types'

describe('Router参数中间件测试', () => {
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
})