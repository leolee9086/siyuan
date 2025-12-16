import z from "zod";
import { accountApiDefs } from "./account";

// 基础 API 定义类型
export interface ApiDef {
  method: string;
  endpoint: string;
  en: string;
  zh_cn: string;
  needAuth: boolean;
  needAdminRole: boolean;
  unavailableIfReadonly: boolean;
  description: string;
  zodRequestSchema: () => z.ZodTypeAny;
  zodResponseSchema: () => z.ZodTypeAny;
}

// 从 API 定义中提取请求和响应类型
type ExtractRequestType<T extends ApiDef> = 
  ReturnType<T["zodRequestSchema"]> extends z.ZodType<infer U> ? U : never;

type ExtractResponseType<T extends ApiDef> = 
  ReturnType<T["zodResponseSchema"]> extends z.ZodType<infer U> ? U : never;

// 将 API 定义数组转换为方法映射类型
type ApiMethods<T extends readonly ApiDef[]> = {
  [K in T[number] as K["en"] | K["zh_cn"]]: 
    ExtractRequestType<K> extends Record<string, never> 
      ? () => Promise<ExtractResponseType<K>>
      : (request: ExtractRequestType<K>) => Promise<ExtractResponseType<K>>;
};

// 配置接口
export interface ApiFetcherConfig {
  host: string;
  port?: number;
  basePath?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

class ApiFetcherImpl {
  public config: ApiFetcherConfig;
  public methods: Record<string, Function> = {};

  constructor(config: ApiFetcherConfig) {
    this.config = {
      basePath: "",
      timeout: 10000,
      headers: {},
      ...config
    };
  }

  // 动态添加 API 方法
  $use<T extends readonly ApiDef[]>(apiDefs: T): this & ApiMethods<T> {
    for (const apiDef of apiDefs) {
      const methodImpl = this.createMethodImpl(apiDef);
      
      // 同时添加英文和中文方法名
      this.methods[apiDef.en] = methodImpl;
      this.methods[apiDef.zh_cn] = methodImpl;
    }

    return this as this & ApiMethods<T>;
  }

  public createMethodImpl(apiDef: ApiDef): Function {
    return (requestData?: any) => {
      const url = this.buildUrl(apiDef.endpoint);
      const requestSchema = apiDef.zodRequestSchema();
      const responseSchema = apiDef.zodResponseSchema();

      // 验证请求数据
      let validatedData: any;
      try {
        // 如果请求模式是空对象，则不验证任何数据
        if (this.isEmptySchema(requestSchema)) {
          validatedData = undefined;
        } else {
          validatedData = requestSchema.parse(requestData);
        }
      } catch (error) {
        return Promise.reject(new Error(`请求数据验证失败: ${error}`));
      }

      // 构建请求选项
      const options: RequestInit = {
        method: apiDef.method,
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
        },
      };

      // 添加请求体（如果不是 GET 请求且有数据）
      if (apiDef.method !== "GET" && validatedData !== undefined) {
        options.body = JSON.stringify(validatedData);
      }

      // 处理认证和权限（这里只是示例，实际使用时需要根据你的认证系统实现）
      if (apiDef.needAuth) {
        // 添加认证头等
        // options.headers['Authorization'] = `Bearer ${getToken()}`;
      }

      // 使用 Promise.race 实现超时控制
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("请求超时")), this.config.timeout);
      });

      const fetchPromise = fetch(url, options)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          // 验证响应数据
          return responseSchema.parse(data);
        });

      return Promise.race([fetchPromise, timeoutPromise]);
    };
  }

  public buildUrl(endpoint: string): string {
    const { host, port, basePath } = this.config;
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const portPart = port ? `:${port}` : "";
    const basePathPart = basePath ? `/${basePath.replace(/^\/|\/$/g, "")}` : "";
    
    return `${protocol}://${host}${portPart}${basePathPart}${endpoint}`;
  }

  public isEmptySchema(schema: z.ZodTypeAny): boolean {
    // 检查是否是空对象模式
    return schema instanceof z.ZodObject && Object.keys(schema.shape).length === 0;
  }
}

// 创建类型安全的 API Fetcher 工厂函数
export function createApiFetcher(config: ApiFetcherConfig) {
  return new ApiFetcherImpl(config);
}

// 创建 API Fetcher 实例
const fetcher = createApiFetcher({
  host: "localhost",
  port: 3000,
  basePath: "/api",
  timeout: 5000,
  headers: {
    "X-Custom-Header": "value"
  }
});

// 使用 API 定义注册方法
const api = fetcher.$use(accountApiDefs );