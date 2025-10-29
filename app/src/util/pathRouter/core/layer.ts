import { pathToRegexp, compile, ParseOptions, Key, TokensToRegexpOptions } from 'path-to-regexp'
import { parse as parseUrl, format as formatUrl, UrlObject } from "url"
import { MiddlewareFunction, Context } from './types';
import { LayerLike } from './layerLike.types';

// 类型守卫函数
function hasName(token: Key | string): token is Key {
  return typeof token === 'object' && token !== null && 'name' in token;
}

// 类型定义
interface LayerOptions {
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


/**
 * Safe decodeURIComponent, won't throw any error.
 * If `decodeURIComponent` error happen, just return the original value.
 *
 * @param {String} text
 * @returns {String} URL decode original string.
 * @private
 */
function safeDecodeURIComponent(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch (e) {
    return text;
  }
}

export default class Layer implements LayerLike {
  public opts: LayerOptions;
  public name: string | null;
  public methods: string[];
  public paramNames: Key[];
  public stack: (MiddlewareFunction & { param?: string })[];
  public path: string | RegExp;
  public regexp: RegExp;
  public schema: { request?: any; response?: any; } | undefined;

  constructor(path: string | RegExp, methods: string[], middleware: MiddlewareFunction | MiddlewareFunction[], opts: LayerOptions = {}) {
    this.opts = opts;
    this.schema = opts.schema;
    this.name = this.opts.name || null;
    this.methods = [];
    this.paramNames = [];
    this.stack = Array.isArray(middleware) ? middleware : [middleware];

    for (const method of methods) {
      const upperMethod = method.toUpperCase();
      if (!this.methods.includes(upperMethod)) {
        this.methods.push(upperMethod);
      }
    }

    // 确保HEAD方法在GET方法之后
    if (this.methods.includes('GET') && !this.methods.includes('HEAD')) {
      this.methods.push('HEAD');
    }

    // ensure middleware is a function or router
    for (const fn of this.stack) {
      const type = typeof fn;
      if (type !== 'function') {
        throw new Error(
          `${methods.toString()} \`${this.opts.name || path
          }\`: \`middleware\` must be a function or router, not \`${type}\``
        );
      }
    }

    this.path = path;
    const options: TokensToRegexpOptions & ParseOptions = {
      end: this.opts.end !== false,
      sensitive: this.opts.sensitive,
      delimiter: this.opts.delimiter
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
      if (this.paramNames[i]) {
        const c = captures[i];
        const paramName = this.paramNames[i];
        if (hasName(paramName)) {
          if (c && c.length > 0) {
            params[paramName.name] = c ? safeDecodeURIComponent(c) : c;
          }
        }
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
    if (!match) return [];

    return match.slice(1);
  }

  /**
   * Generate URL for route using given `params`.
   *
   * @example
   *
   * ```javascript
   * const route = new Layer('/users/:id', ['GET'], fn);
   *
   * route.url({ id: 123 }); // => "/users/123"
   * ```
   *
   * @param {Object} params url parameters
   * @returns {String}
   * @private
   */
  public url(params: Record<string, any> | any[], options?: { query?: string | Record<string, any> }): string {
    const pathStr = typeof this.path === 'string' ? this.path : '';
    const url = pathStr.replace(/\(\.\*\)/g, '');
    const toPath = compile(url, { encode: encodeURIComponent });

    let replaced = toPath(params);

    if (options && options.query) {
      const urlObject: UrlObject = parseUrl(replaced);
      if (typeof options.query === 'string') {
        urlObject.search = options.query;
      } else {
        urlObject.search = undefined;
        urlObject.query = options.query;
      }
      return formatUrl(urlObject);
    }

    return replaced;
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
   * @returns {Layer}
   * @private
   */
  public param(param: string, fn: (param: string, ctx: Context, next: () => void) => void): LayerLike {
    const { stack, paramNames } = this;
    const middleware: MiddlewareFunction & { param?: string } = (ctx, next) => {
      const p = ctx.params[param];
      return fn.call(this, p, ctx, next);
    };
    middleware.param = param;

    const names = paramNames.map(p => p.name);
    const x = names.indexOf(param);

    if (x > -1) {
      stack.some((fn, i) => {
        if (!fn.param || (fn.param && names.indexOf(fn.param) > x)) {
          stack.splice(i, 0, middleware);
          return true;
        }
        return false;
      });
    }
    return this;
  }

  /**
   * Prefix route path.
   *
   * @param {String} prefix
   * @returns {Layer}
   * @private
   */
  public setPrefix(prefix: string): LayerLike {
    if (typeof this.path === 'string') {
      this.path = this.path === '/' && this.opts.strict !== true ? prefix : `${prefix}${this.path}`;
      const options: TokensToRegexpOptions & ParseOptions = {
        end: this.opts.end !== false,
        sensitive: this.opts.sensitive,
        delimiter: this.opts.delimiter
      };
      const tokens: Key[] = [];
      this.regexp = pathToRegexp(this.path, tokens, options);
      this.paramNames = tokens;
    }

    return this;
  }
}