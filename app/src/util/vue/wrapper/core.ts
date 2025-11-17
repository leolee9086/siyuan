import { defineComponent, computed, h, markRaw, onMounted, onBeforeUnmount, onBeforeUpdate, onUpdated } from 'vue';
import type { VueComponent, ComponentWrapperConfig } from './types';

// 缓存Map，用于存储转换结果
const transformCache = new WeakMap();

/**
 * 创建组件包装器
 * @param component 要包装的Vue组件
 * @param config 包装器配置
 * @returns 包装后的Vue组件
 */
export function createComponentWrapper<TProps = any, TEmit = any>(
  component: VueComponent,
  config: ComponentWrapperConfig<TProps, TEmit> = {}
): VueComponent {
  const {
    propsInterceptor,
    emitInterceptor,
    hooks,
    debug
  } = config;

  // 获取组件信息
  const componentName = (component as any)?.name || 'Component';
  const componentProps = (component as any)?.props || {};
  const componentEmits = (component as any)?.emits || {};
  console.log(componentName,componentProps,componentEmits)
  // 创建包装后的组件
  const WrappedComponent = defineComponent({
    name: `Wrapped${componentName}`,
    props: componentProps,
    emits: componentEmits,
    setup(props, { emit, attrs, slots }) {
      // 创建响应式的转换后props，带缓存
      const transformedProps = computed(() => {
        // 生成缓存键
        const cacheKey = JSON.stringify(props);
        
        // 检查缓存
        if (transformCache.has(props)) {
          const cached = transformCache.get(props);
          if (cached.key === cacheKey) {
            return cached.value;
          }
        }
        
        let result = { ...props } as Record<string, any>;
        
        try {
          // 应用默认值
          if (propsInterceptor?.defaults) {
            result = { ...propsInterceptor.defaults, ...result };
          }
          
          // 应用转换器
          if (propsInterceptor?.transform) {
            Object.entries(propsInterceptor.transform).forEach(([key, transformer]) => {
              if (key in result && typeof transformer === 'function') {
                result[key] = transformer(result[key]);
              }
            });
          }
          
          // 应用拦截器
          if (propsInterceptor?.intercept) {
            result = { ...result, ...propsInterceptor.intercept(result as TProps) };
          }
          
          // 验证props（如果配置了验证）
          if (propsInterceptor?.validate) {
            const validationResult = propsInterceptor.validate(result as TProps);
            if (validationResult === false) {
              console.warn('[ComponentWrapper] Props validation failed');
            } else if (typeof validationResult === 'string') {
              console.warn('[ComponentWrapper] Props validation failed:', validationResult);
            }
          }
          
          // 缓存结果
          transformCache.set(props, { key: cacheKey, value: result });
          
          // 调试日志
          if (debug?.enableLogging) {
            console.log('[ComponentWrapper] Props transformed:', { original: props, transformed: result });
          }
          
          return result;
        } catch (error) {
          console.error('[ComponentWrapper] Props transformation error:', error);
          return props;
        }
      });

      // 创建代理emit函数
      const proxyEmit = (eventName: string, ...args: any[]) => {
        try {
          // 应用前缀/后缀
          let finalEventName = eventName;
          if (emitInterceptor?.prefix) {
            finalEventName = emitInterceptor.prefix + eventName;
          }
          if (emitInterceptor?.suffix) {
            finalEventName = eventName + emitInterceptor.suffix;
          }
          
          // 应用事件映射
          if (emitInterceptor?.map?.[eventName as keyof TEmit]) {
            finalEventName = emitInterceptor.map[eventName as keyof TEmit]!;
          }
          
          // 应用拦截器
          if (emitInterceptor?.intercept) {
            const shouldEmit = emitInterceptor.intercept(eventName, ...args);
            if (!shouldEmit) {
              if (debug?.enableLogging) {
                console.log('[ComponentWrapper] Event intercepted:', eventName);
              }
              return;
            }
          }
          
          // 应用转换器
          let finalArgs = args;
          if (emitInterceptor?.transform?.[eventName as keyof TEmit]) {
            const transformer = emitInterceptor.transform[eventName as keyof TEmit];
            if (typeof transformer === 'function') {
              finalArgs = transformer(...args);
            }
          }
          
          // 调试日志
          if (debug?.enableLogging) {
            console.log('[ComponentWrapper] Event emitted:', { 
              original: eventName, 
              final: finalEventName, 
              args: finalArgs 
            });
          }
                                                          console.log(eventName)

          // 触发原始emit
          emit(finalEventName, ...finalArgs);
        } catch (error) {
          console.error('[ComponentWrapper] Emit error:', error);
        }
      };

      // 生命周期钩子
      if (hooks?.beforeMount) {
        hooks.beforeMount(transformedProps.value as TProps);
      }

      // 添加完整的生命周期钩子
      onMounted(() => {
        if (hooks?.afterMount) {
          hooks.afterMount(transformedProps.value as TProps);
        }
      });

      onBeforeUnmount(() => {
        if (hooks?.beforeUnmount) {
          hooks.beforeUnmount();
        }
      });

      onBeforeUpdate(() => {
        if (hooks?.beforeUpdate) {
          hooks.beforeUpdate(transformedProps.value as TProps);
        }
      });

      onUpdated(() => {
        if (hooks?.afterUpdate) {
          hooks.afterUpdate(transformedProps.value as TProps);
        }
      });

      // 渲染函数
      return () => {
        const startTime = debug?.enablePerformance ? performance.now() : 0;
        
        try {
          // 动态创建符合Vue 3格式的事件处理器
          const eventHandlers = (Array.isArray(componentEmits) ? componentEmits : Object.keys(componentEmits)).reduce((acc, eventName) => {
            // 保留冒号，只将第一个字母大写
            const handlerPropName = `on${eventName.charAt(0).toUpperCase() + eventName.slice(1)}`;
            acc[handlerPropName] = (...args: any[]) => proxyEmit(eventName, ...args);
            return acc;
          }, {} as Record<string, (...args: any[]) => void>);
          console.log(eventHandlers)

          // 手动添加 v-model 的事件处理器,确保它总是被捕获
          eventHandlers['onUpdate:modelValue'] = (...args: any[]) => proxyEmit('update:modelValue', ...args);

          const result = h(component, {
            ...transformedProps.value,
            ...attrs,
            ...eventHandlers // 将事件处理器作为props传递
          }, slots);
          
          if (debug?.enablePerformance) {
            const endTime = performance.now();
            console.log(`[ComponentWrapper] Render time: ${endTime - startTime}ms`);
          }
          
          return result;
        } catch (error) {
          console.error('[ComponentWrapper] Render error:', error);
          return h('div', { class: 'error' }, 'Component render error');
        }
      };
    }
  });

  // 标记为原始对象，避免响应式包装
  return markRaw(WrappedComponent);
} 