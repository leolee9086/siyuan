import type { Component, DefineComponent } from "vue";
import { Extend } from "zod/v4/core/util.cjs";

// 基础类型定义 - 只包含组件定义，不包含实例
export type VueComponent = DefineComponent<any, any, any> | Component;

// 获取组件名称的类型辅助函数
export type ComponentName<T> = T extends { name?: string } ? T["name"] : string;

// 获取组件props的类型辅助函数
export type ComponentProps<T> = T extends { props?: any } ? T["props"] : any;

// 获取组件emits的类型辅助函数
export type ComponentEmits<T> = T extends { emits?: any } ? T["emits"] : any;

// Props类型推导
export type InferProps<T> = T extends DefineComponent<infer P, any, any> ? P : any;

// Emit类型推导 - 改进版本
export type InferEmit<T> = T extends DefineComponent<any, any, any, any, any, any, any, infer E extends string[]> 
  ? E 
  : T extends { emits?: infer E } 
    ? E 
    : any;

// 包装器类型
export type ComponentWrapper = (component: VueComponent) => VueComponent;

// Props拦截器配置
export interface PropsInterceptorConfig<TProps = any> {
  // 拦截并修改props
  intercept?: (props: TProps, forceUpdate?: (updatedProps?: Partial<TProps>) => void) => Partial<TProps>;
  
  // 转换特定prop的值
  transform?: {
    [K in keyof TProps]?: (value: TProps[K]) => any;
  };
  
  // 设置默认值
  defaults?: Partial<TProps>;
  
  // 验证props
  validate?: (props: TProps) => boolean | string;
}

// Emit拦截器配置
export interface EmitInterceptorConfig<TEmit = any> {
  // 拦截事件
  intercept?: (eventName: string, ...args: any[]) => boolean;
  
  // 转换事件参数
  transform?: {
    [K in keyof TEmit]?: (...args: any[]) => any[];
  };
  
  // 事件名称前缀
  prefix?: string;
  
  // 事件名称后缀
  suffix?: string;
  
  // 事件映射
  map?: {
    [K in keyof TEmit]?: string;
  };
}

// 生命周期钩子
export interface LifecycleHooks<TProps = any> {
  beforeMount?: (props: TProps) => void;
  afterMount?: (props: TProps) => void;
  beforeUnmount?: () => void;
  beforeUpdate?: (props: TProps) => void;
  afterUpdate?: (props: TProps) => void;
}

// 调试选项
export interface DebugOptions {
  enableLogging?: boolean;
  enablePerformance?: boolean;
  enableTypeChecking?: boolean;
}

// 主配置接口
export interface ComponentWrapperConfig<TProps = any, TEmit = any> {
  // Props拦截器配置
  propsInterceptor?: PropsInterceptorConfig<TProps>;
  
  // Emit拦截器配置
  emitInterceptor?: EmitInterceptorConfig<TEmit>;
  
  // 生命周期钩子
  hooks?: LifecycleHooks<TProps>;
  
  // 调试选项
  debug?: DebugOptions;
}

// 转换后的Props类型 - 改进版本
export type TransformedProps<TProps, TTransform> = {
  [K in keyof TProps]: K extends keyof TTransform 
    ? TTransform[K] extends (...args: any[]) => infer R
      ? R
      : TProps[K]
    : TProps[K];
};

// 转换后的Emit类型 - 改进版本
export type TransformedEmit<TEmit, TTransform> = {
  [K in keyof TEmit]: K extends keyof TTransform
    ? TTransform[K] extends (...args: any[]) => any[]
      ? TEmit[K] extends (...args: any[]) => any
        ? (...args: Parameters<TEmit[K]>) => ReturnType<TEmit[K]>
        : TEmit[K]
      : TEmit[K]
    : TEmit[K];
};

// 高级类型工具
export type If<T extends boolean, A, B> = T extends true ? A : B;

export type Extract<T, U> = T extends U ? T : never;

export type Exclude<T, U> = T extends U ? never : T;

export type MapProps<T, F> = {
  [K in keyof T]: F extends (value: T[K]) => infer R ? R : T[K];
};

export type MapEmits<T, F> = {
  [K in keyof T]: F extends (...args: any[]) => infer R ? R : T[K];
};

export type ValidateProps<T> = T extends Record<string, any> ? T : never;

export type ValidateEmits<T> = T extends Record<string, any> ? T : never;

// 测试相关类型 - 移除jest依赖
export interface TestWrapperOptions<TProps = any> {
  mockProps?: Partial<TProps>;
  mockEmit?: (...args: any[]) => void;
  spyOn?: boolean;
}

export interface TestWrapperResult {
  wrapper: VueComponent;
  propsSpy: (...args: any[]) => void;
  emitSpy: (...args: any[]) => void;
}

// 性能测试结果
export interface PerformanceResult {
  averageRenderTime: number;
  memoryUsage: number;
  propsTransformTime: number;
  emitTransformTime: number;
}

// 验证结果
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} 