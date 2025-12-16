import type { VueComponent, ComponentWrapper } from "./types";
import { createComponentWrapper } from "./core";

/**
 * 创建专门用于props拦截的高阶组件工厂
 * @param propsInterceptor props拦截函数
 * @returns 高阶组件函数
 */
export function withProps<TProps>(
  propsInterceptor: (props: TProps) => Partial<TProps>
): ComponentWrapper {
  return (component: VueComponent) => {
    return createComponentWrapper(component, {
      propsInterceptor: {
        intercept: propsInterceptor
      }
    });
  };
}
/**
 * 创建专门用于emit拦截的高阶组件工厂
 * @param emitInterceptor emit拦截函数
 * @returns 高阶组件函数
 */
export function withEmit(
  emitInterceptor: (eventName: string, ...args: any[]) => boolean
): ComponentWrapper {
  return (component: VueComponent) => {
    return createComponentWrapper(component, {
      emitInterceptor: {
        intercept: emitInterceptor
      }
    });
  };
}

/**
 * 组合多个包装器
 * @param wrappers 要组合的包装器数组
 * @returns 组合后的包装器
 */
export function composeWrappers(...wrappers: ComponentWrapper[]): ComponentWrapper {
  return (component: VueComponent) => {
    return wrappers.reduce((wrappedComponent, wrapper) => {
      return wrapper(wrappedComponent);
    }, component);
  };
} 