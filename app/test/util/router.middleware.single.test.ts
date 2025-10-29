import Router from '../../src/util/router/core/router'
import type { Context } from '../../src/util/router/core/types'

describe('Router单个中间件测试', () => {
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
})