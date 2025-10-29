import { parse as parseUrl, format as formatUrl, UrlObject } from "url";
import BaseLayer from './baseLayer';
import { MiddlewareFunction, Context } from './types';
import { LayerLike } from './layerLike.types';

// 网络层配置接口
interface NetworkLayerOptions {
  methods?: string[];
  urlDecoder?: (text: string) => string;
  urlQueryHandler?: (path: string, query?: string | Record<string, any>) => string;
}

// 默认URL解码器
const defaultUrlDecoder = (text: string): string => {
  try {
    return decodeURIComponent(text);
  } catch (e) {
    return text;
  }
};

// 默认URL查询处理器
const defaultUrlQueryHandler = (path: string, query?: string | Record<string, any>): string => {
  if (!query) return path;
  
  const urlObject: UrlObject = parseUrl(path);
  if (typeof query === 'string') {
    urlObject.search = query;
  } else {
    urlObject.search = undefined;
    urlObject.query = query;
  }
  return formatUrl(urlObject);
};

export default class NetworkLayer extends BaseLayer implements LayerLike {
  public methods: string[] = [];
  private urlDecoder: (text: string) => string;
  private urlQueryHandler: (path: string, query?: string | Record<string, any>) => string;

  constructor(
    path: string | RegExp,
    methods: string[],
    middleware: MiddlewareFunction | MiddlewareFunction[],
    opts: any = {},
    networkConfig: NetworkLayerOptions = {}
  ) {
    // 检查第4个参数是否是网络配置而不是选项
    let actualOpts = opts;
    let actualNetworkConfig = networkConfig;
    
    // 如果第4个参数包含网络配置属性，则调整参数
    if (opts && (opts.urlDecoder !== undefined || opts.urlQueryHandler !== undefined)) {
      actualOpts = {};
      actualNetworkConfig = opts;
    }
    
    super(path, middleware, actualOpts);
    
    this.urlDecoder = actualNetworkConfig.urlDecoder || defaultUrlDecoder;
    this.urlQueryHandler = actualNetworkConfig.urlQueryHandler || defaultUrlQueryHandler;
    
    // 处理HTTP方法
    this.methods = [];
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

    // 设置网络特定的参数处理器
    this.setParameterProcessor({
      decode: this.urlDecoder
    });
  }

  /**
   * 重写URL生成方法，支持查询参数
   *
   * @param {Object} params url parameters
   * @param {Object} options URL选项，包含查询参数
   * @returns {String}
   */
  public url(params: Record<string, any> | any[], options?: { query?: string | Record<string, any>, encode?: (text: string) => string }): string {
    // 使用自定义解码器处理参数
    const processedParams = Array.isArray(params)
      ? params.map(p => typeof p === 'string' ? this.urlDecoder(p) : p)
      : Object.keys(params).reduce((acc, key) => {
        acc[key] = typeof params[key] === 'string' ? this.urlDecoder(params[key]) : params[key];
        return acc;
      }, {} as Record<string, any>);
    
    // 使用自定义编码器（如果提供）或者默认的encodeURIComponent
    const encoder = options?.encode || ((text: string) => text);
    const baseUrl = super.url(processedParams, { encode: encoder });
    
    // 如果有查询参数，总是使用自定义查询处理器
    if (options && options.query !== undefined) {
      return this.urlQueryHandler(baseUrl, options.query);
    }
    
    return baseUrl;
  }

  /**
   * 检查是否支持指定的HTTP方法
   *
   * @param {String} method
   * @returns {Boolean}
   */
  public supportsMethod(method: string): boolean {
    return this.methods.includes(method.toUpperCase());
  }

  /**
   * 获取所有支持的HTTP方法
   *
   * @returns {String[]}
   */
  public getSupportedMethods(): string[] {
    return [...this.methods];
  }
}