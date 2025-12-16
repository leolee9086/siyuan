import { defineComponent, computed, h, markRaw, onMounted, onBeforeUnmount, onBeforeUpdate, onUpdated } from "vue";
import type { VueComponent, ComponentWrapperConfig } from "./types";
import { assertType, getType } from "./assertType";

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
  const componentName = (component as any)?.name || "Component";
  const componentProps = (component as any)?.props || {};
  const componentEmits = (component as any)?.emits || {};
  console.log(componentName,componentProps,componentEmits);
  
  // 处理props定义，移除required约束并收集原始required信息
  const { wrapperProps, originalRequiredProps } = processComponentProps(componentProps);
  
  // 创建包装后的组件
  const WrappedComponent = defineComponent({
    name: `Wrapped${componentName}`,
    props: wrapperProps,
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
          
          
          
          // 应用拦截器
          if (propsInterceptor?.intercept) {
            result = { ...result, ...propsInterceptor.intercept(result as TProps) };
             Object.entries(result).forEach(([key, value])=>{
              console.log(`组件属性${key}已经注入为${value}`);
             });         
              console.log("由于vue的校验机制,此处如果prop设置为required依旧会警告,但是不影响运行时行为");
          }
          // 应用转换器,转换在拦截之后进行
          if (propsInterceptor?.transform) {
            Object.entries(propsInterceptor.transform).forEach(([key, transformer]) => {
              if (key in result && typeof transformer === "function") {
                result[key] = transformer(result[key]);
              }
            });
          }
          // 验证props（如果配置了验证）
          if (propsInterceptor?.validate) {
            const validationResult = propsInterceptor.validate(result as TProps);
            if (validationResult === false) {
              console.warn("[ComponentWrapper] Props validation failed");
            } else if (typeof validationResult === "string") {
              console.warn("[ComponentWrapper] Props validation failed:", validationResult);
            }
          }
          
          // 缓存结果
          transformCache.set(props, { key: cacheKey, value: result });
          
          // 调试日志
          if (debug?.enableLogging) {
            console.log("[ComponentWrapper] Props transformed:", { original: props, transformed: result });
          }
          
          // 验证原始required属性在转换后是否仍然缺失
          validateTransformedRequiredProps(result, originalRequiredProps, componentProps, componentName);
          
          return result;
        } catch (error) {
          console.error("[ComponentWrapper] Props transformation error:", error);
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
                console.log("[ComponentWrapper] Event intercepted:", eventName);
              }
              return;
            }
          }
          
          // 应用转换器
          let finalArgs = args;
          if (emitInterceptor?.transform?.[eventName as keyof TEmit]) {
            const transformer = emitInterceptor.transform[eventName as keyof TEmit];
            if (typeof transformer === "function") {
              finalArgs = transformer(...args);
            }
          }
          
          // 调试日志
          if (debug?.enableLogging) {
            console.log("[ComponentWrapper] Event emitted:", { 
              original: eventName, 
              final: finalEventName, 
              args: finalArgs 
            });
          }
                                                          console.log(eventName);

          // 触发原始emit
          emit(finalEventName, ...finalArgs);
        } catch (error) {
          console.error("[ComponentWrapper] Emit error:", error);
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
          console.log(eventHandlers);

          // 手动添加 v-model 的事件处理器,确保它总是被捕获
          eventHandlers["onUpdate:modelValue"] = (...args: any[]) => proxyEmit("update:modelValue", ...args);
          console.log(transformedProps.value);
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
          console.error("[ComponentWrapper] Render error:", error);
          return h("div", { class: "error" }, "Component render error");
        }
      };
    }
  });

  // 标记为原始对象，避免响应式包装
  return markRaw(WrappedComponent);
}

/**
 * 处理组件props定义，移除required约束并收集原始required信息
 * @param componentProps 原始组件props定义
 * @returns 处理后的props定义和原始required属性集合
 */
function processComponentProps(componentProps: Record<string, any>) {
  const wrapperProps: Record<string, any> = {};
  const originalRequiredProps: Set<string> = new Set();
  
  Object.entries(componentProps).forEach(([key, propDef]) => {
    // 收集原始required信息
    if (propDef && typeof propDef === "object" && propDef.required) {
      originalRequiredProps.add(key);
    }
    
    // 创建新的prop定义，移除required约束
    if (propDef && typeof propDef === "object") {
      wrapperProps[key] = { ...propDef };
      delete wrapperProps[key].required; // 移除required约束
    } else {
      wrapperProps[key] = propDef;
    }
  });
  
  return { wrapperProps, originalRequiredProps };
}



/**
 * 验证转换后的props是否仍然缺少原始required属性
 * 参考Vue内部的validateProp函数实现，提供更完善的警告信息
 * @param transformedProps 转换后的props
 * @param originalRequiredProps 原始required属性集合
 * @param componentProps 原始组件props定义
 * @param componentName 组件名称
 */
function validateTransformedRequiredProps(
  transformedProps: Record<string, any>,
  originalRequiredProps: Set<string>,
  componentProps: Record<string, any>,
  componentName: string
) {
  originalRequiredProps.forEach(propName => {
    const value = transformedProps[propName];
    const isAbsent = !(propName in transformedProps) || value === undefined;
    const prop = componentProps[propName];
    
    if (isAbsent) {
      // 模拟Vue内部的警告格式
      const warnMessage = `Missing required prop: "${propName}"`;
      const componentInfo = componentName ? ` (found in component "${componentName}")` : "";
      
      console.warn(`[ComponentWrapper]${componentInfo} ${warnMessage}`);
      
      // 提供更详细的上下文信息
      console.warn(
        `[ComponentWrapper] 经过绑定转换之后，组件 ${componentName} 仍然缺少必需属性 "${propName}"。` +
        "请检查propsInterceptor配置是否正确提供了该属性的值。"
      );
    } else if (value != null && prop && prop.type && !prop.skipCheck) {
      // 进行类型验证
      const types = Array.isArray(prop.type) ? prop.type : [prop.type];
      const expectedTypes: string[] = [];
      let isValid = false;
      
      for (let i = 0; i < types.length && !isValid; i++) {
        const { valid, expectedType } = assertType(value, types[i]);
        expectedTypes.push(expectedType || "");
        isValid = valid;
      }
      
      if (!isValid) {
        const componentInfo = componentName ? ` (found in component "${componentName}")` : "";
        const expectedTypesStr = expectedTypes.length > 1 ?
          `one of expected types: [${expectedTypes.join(", ")}]` :
          `expected type: ${expectedTypes[0]}`;
        
        console.warn(
          `[ComponentWrapper]${componentInfo} Invalid prop: type check failed for prop "${propName}". ` +
          `Expected ${expectedTypesStr}, got ${getType(value)}.`
        );
      }
      
      // 自定义验证器检查
      if (prop.validator && !prop.validator(value, transformedProps)) {
        const componentInfo = componentName ? ` (found in component "${componentName}")` : "";
        console.warn(
          `[ComponentWrapper]${componentInfo} Invalid prop: custom validator check failed for prop "${propName}".`
        );
      }
    }
  });
}