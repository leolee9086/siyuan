/**
 * Dialog Port 契约检查所需的最小宿主类型。
 *
 * 完整应用的全局声明位于 src/types；这里故意不引入整套应用声明，
 * 避免公共 Port 的日常检查递归加载 App、插件和测试类型图。
 */
interface IObject {
    [key: string]: unknown;
}

interface IProtyle {
    readonly element?: HTMLElement;
}
