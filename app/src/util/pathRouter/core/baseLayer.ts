import { pathToRegexp, compile, ParseOptions, Key, TokensToRegexpOptions } from "path-to-regexp";
import { MiddlewareFunction, Context } from "./types";
import { LayerLike } from "./layerLike.types";

// 类型守卫函数
function hasName(token: Key | string): token is Key {
  return typeof token === "object" && token !== null && "name" in token;
}

// 基础层配置接口
interface BaseLayerOptions {
  name?: string;
  strict?: boolean;
  end?: boolean;
  sensitive?: boolean;
  delimiter?: string;
  ignoreCaptures?: boolean;
  prefix?: string;
  schema?: {
    request?: any;
    response?: any;
  };
}



// 参数处理器接口
interface ParameterProcessor {
  decode: (text: string) => string;
}

// 默认参数处理器
const defaultParameterProcessor: ParameterProcessor = {
  decode: (text: string): string => {
    try {
      return decodeURIComponent(text);
    } catch (e) {
      return text;
    }
  }
};


function createParamMiddleware(param: string, fn: (param: string, ctx: Context, next: () => void) => void, layer: BaseLayer): MiddlewareFunction & { param?: string } {
  return Object.assign(
    (ctx: Context, next: any) => {
      const p = ctx.params[param] as string;
      return fn.call(layer, p, ctx, next);
    },
    { param }
  ) as MiddlewareFunction & { param?: string };
}

export default class BaseLayer implements LayerLike {
  public opts: BaseLayerOptions;
  public name: string | null;
  public paramNames: Key[];
  public stack: (MiddlewareFunction & { param?: string })[];
  public path: string | RegExp;
  public regexp: RegExp;
  public schema: { request?: any; response?: any; } | undefined;
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
  public params(path: string, captures: string[], params: Record<string, any> = {}): Record<string, any> {
    for (let len = captures.length, i = 0; i < len; i++) {
      const paramName = this.paramNames[i];
      const c = captures[i];
      if (paramName && hasName(paramName) && c && c.length > 0) {
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
  public url(params: Record<string, any> | any[], options?: { encode?: (text: string) => string }): string {
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