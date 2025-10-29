import Router from '../../../src/util/pathRouter/core/router.htttpRouter'
import type { Context } from '../../../src/util/pathRouter/core/types'

describe('Router多个中间件测试', () => {
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
})