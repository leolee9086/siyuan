import Router from '../../src/util/router/core/router'
import type { Context } from '../../src/util/router/core/types'

describe('Router中间件错误处理测试', () => {
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

  test('应该正确处理中间件中的错误', async () => {
    const router = new Router()
    const error = new Error('Test error')
    const errorMiddleware = jest.fn((ctx, next) => {
      throw error
    })
    
    router.get('/users/:id', errorMiddleware)
    
    const dispatch = router.routes()
    
    try {
      await dispatch(mockContext, jest.fn())
    } catch (e) {
      expect(e).toBe(error)
    }
    
    expect(errorMiddleware).toHaveBeenCalled()
  })
})