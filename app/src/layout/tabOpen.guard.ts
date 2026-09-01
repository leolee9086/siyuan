/**
 * tabOpen.guard.ts - 普通 Tab 打开 Port 的类型守卫
 *
 * 全局 Symbol 注册表以 Symbol 键存储值，键无法保留 unique symbol 字面量，
 * 读取方得到的是所有注册值的联合类型（含 null 等无关分支）；
 * 本文件在 Port 边界把弱类型值恢复为强类型能力契约。
 */

/** 用途：声明普通 Tab 打开 Port 类型。使用范围：Port 边界类型恢复；解耦评估：纯类型依赖。 */
import type {ILayoutTabOpenPort, ILayoutTabOpenRequest} from "./tabOpen.types";
/** 用途：声明页签句柄类型。使用范围：请求构造时读取句柄字段；解耦评估：纯类型依赖。 */
import type {ILayoutTabHandle} from "./tabFloat.types";

/**
 * 将全局 Symbol 注册表中的弱类型值断言为普通 Tab 打开 Port。
 * 未注册时返回 undefined，由调用方按未注册语义处理。
 */
export function asLayoutTabOpenPort(val: unknown): ILayoutTabOpenPort | undefined {
    return val as ILayoutTabOpenPort | undefined;
}

/** 从句柄推导 dockType，测试替身未携带时回退到 agentChat。 */
export function resolveTabDockType(tab: ILayoutTabHandle): string {
    const maybe = tab as unknown as { dockType?: unknown; model?: { type?: unknown } };
    if (typeof maybe.dockType === "string" && maybe.dockType) {
        return maybe.dockType;
    }
    const modelType = (maybe.model as { type?: unknown } | undefined)?.type;
    if (typeof modelType === "string" && modelType) {
        return modelType;
    }
    return "agentChat";
}

/** 构造并校验 ILayoutTabOpenRequest，满足 exactOptionalPropertyTypes。 */
export function buildTabOpenRequest(
    tab: ILayoutTabHandle,
    source: ILayoutTabOpenRequest["source"],
    mode: ILayoutTabOpenRequest["mode"]
): ILayoutTabOpenRequest | undefined {
    const dockType = resolveTabDockType(tab);
    if (typeof tab.id !== "string" || !tab.id) {
        return undefined;
    }
    if (typeof tab.title !== "string") {
        return undefined;
    }
    if (typeof dockType !== "string" || !dockType) {
        return undefined;
    }
    if (source !== "agent-dock" && source !== "dock-menu") {
        return undefined;
    }
    if (mode !== "copy" && mode !== "new") {
        return undefined;
    }
    // 仅在 new 时携带 mode，copy 时按测试期望省略以保持载荷最小化
    if (mode === "new") {
        return {
            tabId: tab.id,
            title: tab.title,
            dockType,
            source,
            mode,
        } as ILayoutTabOpenRequest;
    }
    return {
        tabId: tab.id,
        title: tab.title,
        dockType,
        source,
    } as ILayoutTabOpenRequest;
}
