import Router from '../../src/util/router/router'
import type { Context } from '../../src/util/router/types'

describe('Router中间件next调用测试', () => {
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
})