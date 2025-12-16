// 核心功能
export { createComponentWrapper } from "./core";

// 高阶组件工厂
export { withProps, withEmit, composeWrappers } from "./factories";

// 工具函数
export { 
  createPropsTransformer, 
  createEmitTransformer, 
  validateWrapper, 
  optimizeWrapper 
} from "./utils";

// 类型定义
export type {
  VueComponent,
  ComponentWrapper,
  ComponentWrapperConfig,
  PropsInterceptorConfig,
  EmitInterceptorConfig,
  LifecycleHooks,
  DebugOptions,
  InferProps,
  InferEmit,
  TransformedProps,
  TransformedEmit,
  ValidationResult,
  PerformanceResult
} from "./types"; 