import Router from '../../src/util/router/router'
import type { Context } from '../../src/util/router/types'

describe('Router中间件异步操作测试', () => {
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
})