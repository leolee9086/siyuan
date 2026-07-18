/** 用途：Vue 应用工厂；使用范围：共享挂载器；解耦评估：通过组件网关统一第三方依赖。 */
import { createApp } from "./imports";
/** 用途：共享宿主组件；使用范围：所有容器挂载；解耦评估：同目录稳定组件入口。 */
import IdentityAccessHost from "./IdentityAccessHost.vue";
/** 用途：挂载参数类型；使用范围：宿主布局种类；解耦评估：纯类型依赖。 */
import type { IdentityAccessMountOptions } from "./IdentityAccessHost.types";

/** 卸载 Vue 应用并移除宿主标记，供 Custom Model 销毁时调用。 */
function unmountIdentityAccess(
    app: ReturnType<typeof createApp>,
    container: HTMLElement,
    className: string,
) {
    app.unmount();
    container.classList.remove("identity-access-container", className);
}

/**
 * 作用：把共享 Identity Access 应用挂载到任意 HTMLElement 并返回卸载句柄。
 * 意图：统一 Dock、Tab 和独立页面的 Vue 生命周期。
 * 调用时机：各容器适配器获得宿主元素后调用。
 */
/** @同步豁免: UI构建 */
export function mountIdentityAccess(
    container: HTMLElement,
    options: IdentityAccessMountOptions,
) {
    const hostClassName = `identity-access-container--${options.hostKind}`;
    container.classList.add("identity-access-container", hostClassName);
    const app = createApp(IdentityAccessHost, { hostKind: options.hostKind });
    app.mount(container);
    return {
        unmount: unmountIdentityAccess.bind(null, app, container, hostClassName),
    };
}
