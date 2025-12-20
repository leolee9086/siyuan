/**
 * 自定义 Fetch 错误类
 */
export class FetchError extends Error {
  constructor(options: {
    message: string
    status?: number
    code?: string
    response?: Response
  }) {
    super(options.message)
    this.name = 'FetchError'
    this.status = options.status
    this.code = options.code
    this.response = options.response
  }

  status?: number
  code?: string
  response?: Response
}