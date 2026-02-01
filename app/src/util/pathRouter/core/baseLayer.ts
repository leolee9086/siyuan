import { pathToRegexp, compile, ParseOptions, Key, TokensToRegexpOptions } from "path-to-regexp";
import type { MiddlewareFunction, Context } from "./types";
import type { LayerLike } from "./layerLike.types";
import type { BaseLayerOptions, ParameterProcessor, RouteSchema, ParamMiddleware } from "./baseLayer.types";
import { isNamedKey, isString } from "./baseLayer.guard";

/**
 * 默认参数处理器实例
 *
 * 作用：提供URL参数的默认解码逻辑
 *
 * 意图：URL参数通常是经过编码的，需要解码才能正确使用。
 *       此处理器使用标准的decodeURIComponent进行解码，
 *       并在解码失败时返回原始值以保证健壮性
 *
 * 调用时机：在BaseLayer构造时作为默认处理器使用，
 *           可通过setParameterProcessor方法替换
 */
const defaultParameterProcessor: ParameterProcessor = {
  /**
   * 解码URL参数值
   *
   * 作用：将URL编码的字符串解码为原始字符串
   *
   * 意图：URL中的特殊字符（如中文、空格等）会被编码，
   *       需要解码才能获取原始值
   *
   * 调用时机：在BaseLayer.params方法中处理每个捕获的参数值时调用
   *
   * @param text - URL编码的参数字符串
   * @returns 解码后的字符串，解码失败时返回原始字符串
   */
  decode: (text: string): string => {
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  }
};

/**
 * 创建参数中间件包装函数
 *
 * 作用：将参数处理函数包装为标准中间件格式，
 *       并附加param属性用于标识处理的参数名
 *
 * 意图：路由器支持为特定参数注册处理函数（如验证、转换），
 *       此函数将这些处理函数转换为可插入中间件栈的格式
 *
 * 调用时机：在BaseLayer.param方法中注册参数处理器时调用
 *
 * @param param - 参数名称
 * @param fn - 参数处理函数
 * @param layer - BaseLayer实例，用于绑定this上下文
 * @returns 包装后的中间件函数，带有param属性标识
 */
function createParamMiddleware(
  param: string,
  fn: (param: string, ctx: Context, next: () => void) => void,
  layer: BaseLayer
): ParamMiddleware {
  const middleware: ParamMiddleware = Object.assign(
    // @内联回调
    (ctx: Context, next: () => Promise<void> | void) => {
      const paramValue = ctx.params[param];
      // 只有当参数值为字符串时才调用处理函数
      if (isString(paramValue)) {
        return fn.call(layer, paramValue, ctx, next);
      }
      return next();
    },
    { param }
  );
  return middleware;
}

export default class BaseLayer implements LayerLike {
  public opts: BaseLayerOptions;
  public name: string | null;
  public paramNames: Key[];
  public stack: ParamMiddleware[];
  public path: string | RegExp;
  public regexp: RegExp;
  public schema: RouteSchema | undefined;
  public parameterProcessor: ParameterProcessor;
  public methods: string[];

  constructor(path: string | RegExp, middleware: MiddlewareFunction | MiddlewareFunction[], opts: BaseLayerOptions = {}) {
    this.opts = opts;
    this.schema = opts.schema;
    this.name = this.opts.name || null;
    this.paramNames = [];
    this.stack = Array.isArray(middleware) ? middleware : [middleware];
    this.parameterProcessor = defaultParameterProcessor;
    this.methods = [];

    // ensure middleware is a function or router
    for (const fn of this.stack) {
      const type = typeof fn;
      if (type !== "function") {
        throw new Error(
          `${this.opts.name || path}: \`middleware\` must be a function or router, not \`${type}\``
        );
      }
    }

    this.path = path;
    const options: TokensToRegexpOptions & ParseOptions = {
      end: this.opts.end !== false,
      ...(this.opts.sensitive !== undefined && { sensitive: this.opts.sensitive }),
      ...(this.opts.delimiter !== undefined && { delimiter: this.opts.delimiter })
    };

    // 当路径是正则表达式时，直接使用该正则作为匹配规则，无需解析参数名
    // 这种情况下paramNames保持为空数组，因为正则表达式不支持命名参数提取
    if (path instanceof RegExp) {
      this.regexp = path;
      return;
    }

    const tokens: Key[] = [];
    this.regexp = pathToRegexp(path, tokens, options);
    this.paramNames = tokens;
  }

  /**
   * Returns whether request `path` matches route.
   *
   * @param {String} path
   * @returns {Boolean}
   * @private
   */
  public match(path: string): boolean {
    return this.regexp.test(path);
  }

  /**
   * Returns map of URL parameters for given `path` and `paramNames`.
   *
   * @param {String} path
   * @param {Array.<String>} captures
   * @param {Object=} params
   * @returns {Object}
   * @private
   */
  public params(path: string, captures: string[], params: Record<string, string> = {}): Record<string, string> {
    for (let len = captures.length, i = 0; i < len; i++) {
      const paramName = this.paramNames[i];
      const c = captures[i];
      // 只有当paramName是具名Key对象（非字符串token）且捕获值非空时才处理
      // 这确保只有有效的命名参数被添加到结果中
      if (paramName && isNamedKey(paramName) && c && c.length > 0) {
        params[paramName.name] = this.parameterProcessor.decode(c);
      }
    }

    return params;
  }

  /**
   * Returns array of regexp url path captures.
   *
   * @param {String} path
   * @returns {Array.<String>}
   * @private
   */
  public captures(path: string): string[] {
    if (this.opts.ignoreCaptures) {
      return [];
    }
    const match = path.match(this.regexp);
    if (!match) {
return [];
}

    return match.slice(1);
  }

  /**
   * Generate URL for route using given `params`.
   *
   * @example
   *
   * ```javascript
   * const route = new BaseLayer('/users/:id', fn);
   *
   * route.url({ id: 123 }); // => "/users/123"
   * ```
   *
   * @param {Object} params url parameters
   * @returns {String}
   * @private
   */
  public url(params: Record<string, string | number | boolean> | (string | number | boolean)[], options?: { encode?: (text: string) => string }): string {
    const pathStr = typeof this.path === "string" ? this.path : "";
    const url = pathStr.replace(/\(\.\*\)/g, "");
    const encoder = options?.encode || encodeURIComponent;
    const toPath = compile(url, { encode: encoder });

    return toPath(params);
  }

  /**
   * Run validations on route named parameters.
   *
   * @example
   *
   * ```javascript
   * router
   *   .param('user', function (id, ctx, next) {
   *     ctx.user = users[id];
   *     if (!ctx.user) return ctx.status = 404;
   *     next();
   *   })
   *   .get('/users/:user', function (ctx, next) {
   *     ctx.body = ctx.user;
   *   });
   * ```
   *
   * @param {String} param
   * @param {Function} middleware
   * @returns {BaseLayer}
   * @private
   */
  public param(param: string, fn: (param: string, ctx: Context, next: () => void) => void): LayerLike {
    const { stack, paramNames } = this;
    const middleware = createParamMiddleware(param, fn, this);

    const names = paramNames.map(p => p.name);
    const x = names.indexOf(param);

    const i = x > -1 ? stack.findIndex((fn) => !fn.param || (fn.param && names.indexOf(fn.param) > x)) : -1;
    // 当找到合适的插入位置时（i > -1），将参数中间件插入到栈中
    // 这确保参数处理器按照参数在路径中出现的顺序执行
    if (i > -1) {
      stack.splice(i, 0, middleware);
    }
    return this;
  }

  /**
   * Prefix route path.
   *
   * @param {String} prefix
   * @returns {BaseLayer}
   * @private
   */
  public setPrefix(prefix: string): LayerLike {
    // 只有当路径是字符串时才能添加前缀，正则表达式路径不支持前缀操作
    // 因为正则表达式需要完整重写才能添加前缀
    if (typeof this.path === "string") {
      this.path = this.path === "/" && this.opts.strict !== true ? prefix : `${prefix}${this.path}`;
      const options: TokensToRegexpOptions & ParseOptions = {
        end: this.opts.end !== false,
        ...(this.opts.sensitive !== undefined && { sensitive: this.opts.sensitive }),
        ...(this.opts.delimiter !== undefined && { delimiter: this.opts.delimiter })
      };
      const tokens: Key[] = [];
      this.regexp = pathToRegexp(this.path, tokens, options);
      this.paramNames = tokens;
    }

    return this;
  }

  /**
   * 配置参数处理器
   *
   * @param {ParameterProcessor} processor
   * @returns {BaseLayer}
   */
  public setParameterProcessor(processor: ParameterProcessor): LayerLike {
    this.parameterProcessor = processor;
    return this;
  }
}