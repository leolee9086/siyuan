import type { VueComponent, ComponentWrapperConfig } from "./wrapper/types";
import { createComponentWrapper } from "./wrapper";
import { computed } from "vue";

/**
 * 绑定组件的v-model到一个有getter函数和setter函数的值对象
 *
 * @param 组件 要绑定的Vue组件
 * @param 值对象 包含getter和setter方法的对象
 * @param 配置 包装器配置选项
 * @param getter函数名 getter函数的名称，默认为'getValue'
 * @param setter函数名 setter函数的名称，默认为'setValue'
 * @returns 包装后的组件，支持v-model绑定
 */
export const 绑定组件vmodel到带有getter函数和setter函数的值对象 = <TValue = any>(
  组件: VueComponent,
  值对象: {
    [key: string]: (() => TValue) | ((value: TValue) => void);
  },
  配置: ComponentWrapperConfig<any, any> = {},
  getter函数名: string = "getValue",
  setter函数名: string = "setValue"
): VueComponent => {
  // 验证必需的函数是否存在
  const getter函数 = 值对象[getter函数名] as (() => TValue);
  const setter函数 = 值对象[setter函数名] as ((value: TValue) => void);
  
  if (typeof getter函数 !== "function") {
    throw new Error(`值对象中缺少必需的getter函数: ${getter函数名}`);
  }
  
  if (typeof setter函数 !== "function") {
    throw new Error(`值对象中缺少必需的setter函数: ${setter函数名}`);
  }

  const wrapped = createComponentWrapper(组件, {
    ...配置,
    propsInterceptor: {
      ...配置.propsInterceptor,
      intercept: (props) => {
        // 如果组件有modelValue属性，将其绑定到值对象
        if ("modelValue" in props) {
          return {
            ...props,
            modelValue: computed({
              get() {
                return getter函数();
              },
              set(val) {
                setter函数(val);
              }
            })
          };
        }
        return props;
      }
    },
    emitInterceptor: {
      ...配置.emitInterceptor,
      intercept: (eventName, ...args) => {
        // 拦截update:modelValue事件，调用值对象的setter函数
        if (eventName === "update:modelValue") {
          setter函数(args[0]);
          return true; // 允许事件继续传播
        }
        return true;
      }
    },
    hooks: {
      ...配置.hooks,
      afterMount: (props) => {
        // 组件挂载后，如果初始值需要同步，可以在这里处理
        if (配置.hooks?.afterMount) {
          配置.hooks.afterMount(props);
        }
      }
    }
  });
  return wrapped;
};

/**
 * 创建v-model绑定器工厂函数
 * 
 * @param 值对象 包含getValue和setValue方法的对象
 * @returns 高阶组件函数，用于绑定v-model
 */
export const 创建vmodel绑定器 = <TValue = any>(
  值对象: {
    [key: string]: (() => TValue) | ((value: TValue) => void);
  },
  getter函数名: string = "getValue",
  setter函数名: string = "setValue"
) => {
  return (组件: VueComponent, 配置?: ComponentWrapperConfig<any, any>) => {
    return 绑定组件vmodel到带有getter函数和setter函数的值对象(组件, 值对象, 配置, getter函数名, setter函数名);
  };
};

/**
 * 绑定多个组件的v-model到同一个值对象
 * 
 * @param 组件数组 要绑定的Vue组件数组
 * @param 值对象 包含getValue和setValue方法的对象
 * @param 配置 包装器配置选项
 * @returns 包装后的组件数组
 */
export const 批量绑定组件vmodel = <TValue = any>(
  组件数组: VueComponent[],
  值对象: {
    [key: string]: (() => TValue) | ((value: TValue) => void);
  },
  配置: ComponentWrapperConfig<any, any> = {},
  getter函数名: string = "getValue",
  setter函数名: string = "setValue"
): VueComponent[] => {
  return 组件数组.map(组件 =>
    绑定组件vmodel到带有getter函数和setter函数的值对象(组件, 值对象, 配置, getter函数名, setter函数名)
  );
};

/**
 * 创建响应式v-model绑定器
 * 使用Vue的ref或reactive来创建响应式值对象
 * 
 * @param 初始值 初始值
 * @returns 包含响应式值对象和绑定器函数的对象
 */
export const 创建响应式vmodel绑定器 = <TValue = any>(
  初始值: TValue,
  getter函数名: string = "getValue",
  setter函数名: string = "setValue"
) => {
  let 当前值 = 初始值;

  const 值对象: Record<string, (() => TValue) | ((value: TValue) => void)> = {
    [getter函数名]: () => 当前值,
    [setter函数名]: (value: TValue) => {
      当前值 = value;
    }
  };

  return {
    值对象,
    绑定器: (组件: VueComponent, 配置?: ComponentWrapperConfig<any, any>) =>
      绑定组件vmodel到带有getter函数和setter函数的值对象(组件, 值对象, 配置, getter函数名, setter函数名),
    获取值: () => 当前值,
    设置值: (value: TValue) => {
 当前值 = value; 
}
  };
};
