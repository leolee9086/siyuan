import type { z } from "zod";
import type { MiddlewareFunction } from "./types";

/**
 * 路由Schema定义接口
 *
 * 用于定义路由层的请求和响应验证schema。
 * 支持使用Zod schema进行类型安全的请求/响应验证。
 *
 * @example
 * ```typescript
 * const schema: RouteSchema = {
 *   request: z.object({ id: z.string() }),
 *   response: z.object({ data: z.any() })
 * };
 * ```
 *
 * @see BaseLayerOptions - 在BaseLayerOptions中作为schema属性使用
 */
export interface RouteSchema {
  /** 请求体验证schema，用于验证传入请求的数据结构 */
  request?: z.ZodTypeAny;
  /** 响应体验证schema，用于验证响应数据的结构 */
  response?: z.ZodTypeAny;
}

/**
 * 基础路由层配置选项接口
 *
 * 定义创建BaseLayer实例时可用的配置选项。
 * 这些选项控制路由匹配行为、路径解析规则和schema验证。
 *
 * @example
 * ```typescript
 * // 基本使用
 * const opts: BaseLayerOptions = {
 *   name: 'userRoute',
 *   strict: true,
 *   end: true
 * };
 *
 * // 带schema验证
 * const optsWithSchema: BaseLayerOptions = {
 *   name: 'apiRoute',
 *   schema: {
 *     request: z.object({ userId: z.string() }),
 *     response: z.object({ user: z.any() })
 *   }
 * };
 * ```
 *
 * @see BaseLayer - 在BaseLayer构造函数中使用
 * @see RouteSchema - schema属性的类型定义
 */
export interface BaseLayerOptions {
  /** 路由名称，用于标识和调试 */
  name?: string;
  /** 是否启用严格模式，影响尾部斜杠的匹配行为 */
  strict?: boolean;
  /** 是否匹配路径末尾，false时允许部分匹配 */
  end?: boolean;
  /** 是否区分大小写进行路径匹配 */
  sensitive?: boolean;
  /** 路径分隔符，默认为 '/' */
  delimiter?: string;
  /** 是否忽略正则表达式捕获组 */
  ignoreCaptures?: boolean;
  /** 路由前缀，会添加到路径前面 */
  prefix?: string;
  /** 请求/响应验证schema配置 */
  schema?: RouteSchema;
}

/**
 * 参数处理器接口
 *
 * 定义URL参数的解码和处理逻辑。
 * 用于自定义路由参数的解析方式。
 *
 * @example
 * ```typescript
 * // 自定义参数处理器
 * const processor: ParameterProcessor = {
 *   decode: (text) => {
 *     try {
 *       return decodeURIComponent(text);
 *     } catch {
 *       return text;
 *     }
 *   }
 * };
 *
 * layer.setParameterProcessor(processor);
 * ```
 *
 * @see BaseLayer.setParameterProcessor - 用于设置参数处理器的方法
 */
export interface ParameterProcessor {
  /**
   * 解码URL参数值
   * @param text - 需要解码的原始参数字符串
   * @returns 解码后的参数值
   */
  decode: (text: string) => string;
}

/**
 * 带参数标记的中间件函数类型
 *
 * 作用：扩展标准中间件函数，添加param属性用于标识
 *       该中间件处理的参数名称
 *
 * 意图：在参数中间件栈中，需要知道每个中间件处理的是哪个参数，
 *       以便按正确顺序插入新的参数处理器
 *
 * @see BaseLayer.param - 在param方法中创建此类型的中间件
 */
export type ParamMiddleware = MiddlewareFunction & { param?: string };
