import { describe, it, expect, beforeEach,test, vi } from 'vitest';

import Router from '../../../src/util/pathRouter/core/router.htttpRouter'
import type { RouterOptions } from '../../../src/util/pathRouter/core/types'
describe('Router基础功能测试', () => {
  test('应该使用默认选项创建Router实例', () => {
    const router = new Router()
    
    expect(router.methods).toEqual([
      'HEAD',
      'OPTIONS',
      'GET',
      'PUT',
      'PATCH',
      'POST',
      'DELETE'
    ])
    expect(router.exclusive).toBe(false)
    expect(router.params).toEqual({})
    expect(router.stack).toEqual([])
    expect(router.host).toBeUndefined()
  })

  test('应该使用自定义选项创建Router实例', () => {
    const options: RouterOptions = {
      methods: ['GET', 'POST'],
      exclusive: true,
      host: 'example.com',
      prefix: '/api'
    }
    
    const router = new Router(options)
    
    expect(router.methods).toEqual(['GET', 'POST'])
    expect(router.exclusive).toBe(true)
    expect(router.host).toBe('example.com')
    expect(router.opts.prefix).toBe('/api')
  })

  test('应该正确设置prefix', () => {
    const router = new Router()
    
    router.prefix('/api')
    
    expect(router.opts.prefix).toBe('/api')
  })

  test('应该正确处理带有尾部斜杠的prefix', () => {
    const router = new Router()
    
    router.prefix('/api/')
    
    expect(router.opts.prefix).toBe('/api')
  })

  test('应该正确匹配host', () => {
    const router1 = new Router({ host: 'example.com' })
    const router2 = new Router({ host: /(?:.*\.)?example\.com$/ })
    const router3 = new Router()
    
    expect(router1.matchHost('example.com')).toBe(true)
    expect(router1.matchHost('test.com')).toBe(false)
    
    expect(router2.matchHost('api.example.com')).toBe(true)
    expect(router2.matchHost('example.com')).toBe(true)
    expect(router2.matchHost('test.com')).toBe(false)
    
    expect(router3.matchHost('anyhost.com')).toBe(true)
    //没有配置host应该匹配任何host
    expect(router3.matchHost()).toBe(true)
  })

  test('应该正确设置参数中间件', () => {
    const router = new Router()
    const paramMiddleware = vi.fn()
    
    router.param('id', paramMiddleware)
    
    expect(router.params.id).toBe(paramMiddleware)
  })

  test('应该正确查找命名路由', () => {
    const router = new Router()
    const middleware = vi.fn()
    
    router.get('userRoute', '/users/:id', middleware)
    
    const route = router.route('userRoute')
    expect(route).toBeTruthy()
    if (route !== false) {
      expect(route.name).toBe('userRoute')
    }
    
    const nonExistentRoute = router.route('nonExistent')
    expect(nonExistentRoute).toBe(false)
  })

  test('应该正确生成URL', () => {
    const router = new Router()
    const middleware = vi.fn()
    
    router.get('userRoute', '/users/:id', middleware)
    
    const url = router.url('userRoute', { id: '123' })
    expect(url).toBe('/users/123')
    
    const error = router.url('nonExistent') as Error
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('No route found for name: nonExistent')
  })

  test('应该正确使用静态url方法', () => {
    const url = Router.url('/users/:id', { id: 123 })
    expect(url).toBe('/users/123')
  })
})