/**
 * fetchWrapper 类型守卫
 */

/**
 * 断言响应为 JSON 类型
 */
export function guardJsonResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}

/**
 * 断言响应为文本类型
 */
export function guardTextResponse<T>(response: Response): Promise<T> {
  return response.text() as unknown as Promise<T>
}