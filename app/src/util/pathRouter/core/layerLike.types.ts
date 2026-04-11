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
