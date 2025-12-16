import { z } from "zod";
import { MiddlewareFunction, Context } from "./types";
import { Key } from "path-to-regexp";

// 基础层配置接口
export interface BaseLayerOptions {
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
export interface ParameterProcessor {
  decode: (text: string) => string;
}

// LayerLike接口定义 - 抽象出所有Layer类的共同特征
export interface LayerLike {
  // 共同属性
  opts: BaseLayerOptions;
  name: string | null;
  paramNames: Key[];
  stack: (MiddlewareFunction & { param?: string })[];
  path: string | RegExp;
  regexp: RegExp;
  schema: { request?: any; response?: any; } | undefined;
  methods:string[]
  // 共同方法
  match(path: string): boolean;
  params(path: string, captures: string[], params?: Record<string, any>): Record<string, any>;
  captures(path: string): string[];
  url(params: Record<string, any> | any[], options?: any): string;
  param(param: string, fn: (param: string, ctx: Context, next: () => void) => void): LayerLike;
  setPrefix(prefix: string): LayerLike;
}

// 使用Zod定义LayerLike的schema
export const layerLikeSchema = z.object({
  opts: z.object({
    name: z.string().optional(),
    strict: z.boolean().optional(),
    end: z.boolean().optional(),
    sensitive: z.boolean().optional(),
    delimiter: z.string().optional(),
    ignoreCaptures: z.boolean().optional(),
    prefix: z.string().optional(),
    schema: z.object({
      request: z.any().optional(),
      response: z.any().optional(),
    }).optional(),
  }),
  name: z.string().nullable(),
  paramNames: z.array(z.any()),
  stack: z.array(z.any()),
  path: z.union([z.string(), z.instanceof(RegExp)]),
  regexp: z.instanceof(RegExp),
  schema: z.object({
    request: z.any().optional(),
    response: z.any().optional(),
  }).optional(),
});

// 推导类型
export type LayerLikeType = z.infer<typeof layerLikeSchema>

// 扩展接口，用于支持HTTP方法的Layer
export interface LayerWithMethods extends LayerLike {
  methods: string[];
}

// 扩展接口，用于支持网络特定功能的Layer
export interface NetworkLayerLike extends LayerWithMethods {
  urlDecoder: (text: string) => string;
  urlQueryHandler: (path: string, query?: string | Record<string, any>) => string;
  supportsMethod(method: string): boolean;
  getSupportedMethods(): string[];
}