import type { VueComponent, ComponentWrapperConfig, ValidationResult } from './types';

/**
 * 创建props转换器
 * @param transformers 转换器配置
 * @returns props转换函数
 */
export function createPropsTransformer<TProps>(
  transformers: {
    [K in keyof TProps]?: (value: TProps[K]) => any;
  }
): (props: TProps) => TProps {
  return (props: TProps) => {
    const result = { ...props } as Record<string, any>;
    
    Object.entries(transformers).forEach(([key, transformer]) => {
      if (key in result && typeof transformer === 'function') {
        result[key] = transformer(result[key]);
      }
    });
    
    return result as TProps;
  };
}

/**
 * 创建emit转换器
 * @param transformers 转换器配置
 * @returns emit转换函数
 */
export function createEmitTransformer<TEmit>(
  transformers: {
    [K in keyof TEmit]?: (...args: any[]) => any[];
  }
): (eventName: string, ...args: any[]) => [string, ...any[]] {
  return (eventName: string, ...args: any[]) => {
    const transformer = transformers[eventName as keyof TEmit];
    if (transformer && typeof transformer === 'function') {
      return [eventName, ...transformer(...args)];
    }
    return [eventName, ...args];
  };
}

/**
 * 合并包装器配置
 * @param configs 要合并的配置数组
 * @returns 合并后的配置
 */
export function mergeWrapperConfigs<TProps, TEmit>(
  ...configs: ComponentWrapperConfig<TProps, TEmit>[]
): ComponentWrapperConfig<TProps, TEmit> {
  return configs.reduce((merged, config) => {
    // 合并props拦截器
    if (config.propsInterceptor) {
      merged.propsInterceptor = {
        ...merged.propsInterceptor,
        ...config.propsInterceptor,
        transform: {
          ...merged.propsInterceptor?.transform,
          ...config.propsInterceptor.transform
        },
        defaults: {
          ...merged.propsInterceptor?.defaults,
          ...config.propsInterceptor.defaults
        }
      };
    }

    // 合并emit拦截器
    if (config.emitInterceptor) {
      merged.emitInterceptor = {
        ...merged.emitInterceptor,
        ...config.emitInterceptor,
        transform: {
          ...merged.emitInterceptor?.transform,
          ...config.emitInterceptor.transform
        },
        map: {
          ...merged.emitInterceptor?.map,
          ...config.emitInterceptor.map
        }
      };
    }

    // 合并生命周期钩子
    if (config.hooks) {
      merged.hooks = {
        ...merged.hooks,
        ...config.hooks
      };
    }

    // 合并调试选项
    if (config.debug) {
      merged.debug = {
        ...merged.debug,
        ...config.debug
      };
    }

    return merged;
  }, {} as ComponentWrapperConfig<TProps, TEmit>);
}

/**
 * 创建开发环境配置
 * @returns 开发环境配置
 */
export function createDevConfig<TProps, TEmit>(): ComponentWrapperConfig<TProps, TEmit> {
  return {
    debug: {
      enableLogging: true,
      enablePerformance: true,
      enableTypeChecking: true
    }
  };
}

/**
 * 创建生产环境配置
 * @returns 生产环境配置
 */
export function createProdConfig<TProps, TEmit>(): ComponentWrapperConfig<TProps, TEmit> {
  return {
    debug: {
      enableLogging: false,
      enablePerformance: false,
      enableTypeChecking: false
    }
  };
}

/**
 * 性能分析工具
 * @param fn 要分析的函数
 * @param iterations 迭代次数
 * @returns 性能分析结果
 */
export function analyzePerformance<T extends (...args: any[]) => any>(
  fn: T,
  iterations: number = 1000
): { averageTime: number; totalTime: number; iterations: number } {
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const averageTime = totalTime / iterations;
  
  return {
    averageTime,
    totalTime,
    iterations
  };
}

/**
 * 验证包装器配置
 * @param config 包装器配置
 * @returns 验证结果
 */
export function validateWrapper<TProps, TEmit>(
  config: ComponentWrapperConfig<TProps, TEmit>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查props拦截器配置
  if (config.propsInterceptor) {
    const { intercept, transform, defaults, validate } = config.propsInterceptor;
    
    if (intercept && typeof intercept !== 'function') {
      errors.push('propsInterceptor.intercept must be a function');
    }
    
    if (transform && typeof transform !== 'object') {
      errors.push('propsInterceptor.transform must be an object');
    }
    
    if (defaults && typeof defaults !== 'object') {
      errors.push('propsInterceptor.defaults must be an object');
    }
    
    if (validate && typeof validate !== 'function') {
      errors.push('propsInterceptor.validate must be a function');
    }
  }

  // 检查emit拦截器配置
  if (config.emitInterceptor) {
    const { intercept, transform, prefix, suffix, map } = config.emitInterceptor;
    
    if (intercept && typeof intercept !== 'function') {
      errors.push('emitInterceptor.intercept must be a function');
    }
    
    if (transform && typeof transform !== 'object') {
      errors.push('emitInterceptor.transform must be an object');
    }
    
    if (prefix && typeof prefix !== 'string') {
      errors.push('emitInterceptor.prefix must be a string');
    }
    
    if (suffix && typeof suffix !== 'string') {
      errors.push('emitInterceptor.suffix must be a string');
    }
    
    if (map && typeof map !== 'object') {
      errors.push('emitInterceptor.map must be an object');
    }
  }

  // 检查生命周期钩子
  if (config.hooks) {
    const { beforeMount, afterMount, beforeUnmount, beforeUpdate, afterUpdate } = config.hooks;
    
    if (beforeMount && typeof beforeMount !== 'function') {
      errors.push('hooks.beforeMount must be a function');
    }
    
    if (afterMount && typeof afterMount !== 'function') {
      errors.push('hooks.afterMount must be a function');
    }
    
    if (beforeUnmount && typeof beforeUnmount !== 'function') {
      errors.push('hooks.beforeUnmount must be a function');
    }
    
    if (beforeUpdate && typeof beforeUpdate !== 'function') {
      errors.push('hooks.beforeUpdate must be a function');
    }
    
    if (afterUpdate && typeof afterUpdate !== 'function') {
      errors.push('hooks.afterUpdate must be a function');
    }
  }

  // 检查调试选项
  if (config.debug) {
    const { enableLogging, enablePerformance, enableTypeChecking } = config.debug;
    
    if (enableLogging && typeof enableLogging !== 'boolean') {
      errors.push('debug.enableLogging must be a boolean');
    }
    
    if (enablePerformance && typeof enablePerformance !== 'boolean') {
      errors.push('debug.enablePerformance must be a boolean');
    }
    
    if (enableTypeChecking && typeof enableTypeChecking !== 'boolean') {
      errors.push('debug.enableTypeChecking must be a boolean');
    }
  }

  // 性能警告
  if (config.propsInterceptor?.intercept) {
    warnings.push('Using propsInterceptor.intercept may impact performance. Consider using transform for specific props instead.');
  }
  
  if (config.emitInterceptor?.intercept) {
    warnings.push('Using emitInterceptor.intercept may impact performance. Consider using transform for specific events instead.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 优化包装器配置
 * @param config 原始配置
 * @returns 优化后的配置
 */
export function optimizeWrapper<TProps, TEmit>(
  config: ComponentWrapperConfig<TProps, TEmit>
): ComponentWrapperConfig<TProps, TEmit> {
  const optimized = { ...config };
  
  // 如果同时有intercept和transform，优先使用transform
  if (optimized.propsInterceptor?.intercept && optimized.propsInterceptor?.transform) {
    console.warn('Both intercept and transform are configured for props. Consider using only transform for better performance.');
  }
  
  if (optimized.emitInterceptor?.intercept && optimized.emitInterceptor?.transform) {
    console.warn('Both intercept and transform are configured for emit. Consider using only transform for better performance.');
  }
  
  // 性能优化建议
  if (optimized.propsInterceptor?.intercept && optimized.propsInterceptor?.transform) {
    console.warn('Both intercept and transform are configured for props. Consider using only transform for better performance.');
  }
  
  if (optimized.emitInterceptor?.intercept && optimized.emitInterceptor?.transform) {
    console.warn('Both intercept and transform are configured for emit. Consider using only transform for better performance.');
  }
  
  return optimized;
} 