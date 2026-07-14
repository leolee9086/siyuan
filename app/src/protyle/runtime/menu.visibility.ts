/**
 * 块标菜单的宿主环境和能力判定。
 * 菜单项默认同时面向完整 App 和独立 Protyle；只有明确声明的能力门槛才会被隐藏。
 */

export type ProtyleMenuHost = "standalone" | "full-app";

export interface IProtyleMenuContext {
    host: ProtyleMenuHost;
    capabilities: ReadonlySet<string>;
    protyle: IProtyle;
    nodeElement?: Element;
    nodeType?: string | null;
    nodeSubType?: string | null;
    session: object;
}

export interface IProtyleMenuVisibility {
    /** 显式设置为 false 时不在独立 Protyle 中显示。 */
    standalone?: boolean;
    /** 显式设置为 false 时不在完整思源 App 中显示。 */
    fullApp?: boolean;
    /** 宿主必须具备的能力名称，供外部菜单扩展动态复用。 */
    requires?: readonly string[];
    /** 根据当前块和宿主状态进行同步判定。异常会使菜单项隐藏。 */
    when?: (context: IProtyleMenuContext) => boolean;
    /** 标记为可在首屏菜单后通过空闲任务追加的可选项。 */
    defer?: boolean;
}

export const PROTYLE_MENU_CONTEXT_KEY = "__protyleMenuContext";
const HIDDEN_MENU_ELEMENT = "data-protyle-menu-hidden";

type MenuDataHost = { data?: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

/** 当前菜单会话上下文只存放在菜单宿主自身，避免增加全局单例状态。 */
export const getProtyleMenuContext = (): IProtyleMenuContext | undefined => {
    const menus = Reflect.get(globalThis, "siyuan")?.menus;
    const data = menus?.menu?.data;
    if (!isRecord(data)) {
        return undefined;
    }
    const context = data[PROTYLE_MENU_CONTEXT_KEY];
    return isRecord(context) && context.protyle && context.capabilities instanceof Set
        ? context as IProtyleMenuContext
        : undefined;
};

/** 为一次块标菜单会话生成能力快照，后续动态菜单判定共享同一快照。 */
export const createProtyleMenuContext = (options: {
    protyle: IProtyle;
    nodeElement?: Element;
    nodeType?: string | null;
    nodeSubType?: string | null;
}): IProtyleMenuContext => {
    const siyuan = Reflect.get(globalThis, "siyuan");
    const host: ProtyleMenuHost = siyuan?.standaloneProtyle === true ? "standalone" : "full-app";
    const capabilities = new Set<string>([
        "dom",
        "kernel",
        "clipboard",
        "block-edit",
    ]);

    if (host === "full-app") {
        ["full-app", "dialogs", "navigation", "plugins", "database", "flashcard", "export", "ai", "media"].forEach(item => capabilities.add(item));
    }
    if (options.protyle.toolbar) {
        capabilities.add("toolbar");
    }
    if (options.protyle.app?.plugins) {
        capabilities.add("plugins");
    }

    return {
        host,
        capabilities,
        protyle: options.protyle,
        nodeElement: options.nodeElement,
        nodeType: options.nodeType,
        nodeSubType: options.nodeSubType,
        session: {},
    };
};

/** 将当前上下文写入菜单宿主，保留宿主可能已有的 data 字段。 */
export const setProtyleMenuContext = (menu: MenuDataHost, context: IProtyleMenuContext) => {
    const data = isRecord(menu.data) ? menu.data : {};
    menu.data = {...data, [PROTYLE_MENU_CONTEXT_KEY]: context};
    return context;
};

/**
 * 将非核心菜单构建放到浏览器空闲时间，并在菜单会话结束后自动丢弃结果。
 * 这使菜单首屏只承担基础编辑操作，复杂扩展可以在菜单已显示后追加。
 */
export const scheduleProtyleMenuTask = (
    context: IProtyleMenuContext,
    task: (context: IProtyleMenuContext) => void,
) => {
    const run = () => {
        const current = getProtyleMenuContext();
        if (!current || current.session !== context.session || current.protyle !== context.protyle) {
            return;
        }
        try {
            task(current);
        } catch (error) {
            console.warn("[protyle-menu] deferred menu task failed", error);
        }
    };
    if (typeof window.requestIdleCallback === "function") {
        const handle = window.requestIdleCallback(run, {timeout: 200});
        return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(run, 0);
    return () => window.clearTimeout(handle);
};

const getVisibility = (item: IMenu) => item.protyle;

/** 在构造 DOM 前判定单个菜单项是否可用。 */
export const isProtyleMenuItemVisible = (
    item: IMenu,
    context: IProtyleMenuContext | undefined = getProtyleMenuContext(),
) => {
    if (!context) {
        return true;
    }
    const visibility = getVisibility(item);
    if (!visibility) {
        return true;
    }
    if (context.host === "standalone" && visibility.standalone === false) {
        return false;
    }
    if (context.host === "full-app" && visibility.fullApp === false) {
        return false;
    }
    if (visibility.requires?.some(capability => !context.capabilities.has(capability))) {
        return false;
    }
    if (visibility.when) {
        try {
            return visibility.when(context);
        } catch (error) {
            console.warn("[protyle-menu] visibility check failed", error);
            return false;
        }
    }
    return true;
};

/** 递归筛选菜单树，并去除孤立分隔线，避免延迟/条件菜单留下空段落。 */
export const filterProtyleMenuItems = (
    items: IMenu[],
    context: IProtyleMenuContext | undefined = getProtyleMenuContext(),
): IMenu[] => {
    const visible = items.flatMap(item => {
        if (!isProtyleMenuItemVisible(item, context)) {
            return [];
        }
        if (!item.submenu) {
            return [item];
        }
        const submenu = filterProtyleMenuItems(item.submenu, context);
        return submenu.length > 0 ? [{...item, submenu}] : [];
    });
    return visible.filter((item, index) => {
        if (item.type !== "separator") {
            return true;
        }
        return index > 0 && index < visible.length - 1 &&
            visible[index - 1]?.type !== "separator" && visible[index + 1]?.type !== "separator";
    });
};

/** 为不应插入 DOM 的菜单项创建可识别占位节点。 */
export const createHiddenProtyleMenuElement = () => {
    const element = document.createElement("template");
    element.setAttribute(HIDDEN_MENU_ELEMENT, "true");
    return element;
};

export const isHiddenProtyleMenuElement = (element?: Element) =>
    element?.getAttribute(HIDDEN_MENU_ELEMENT) === "true";
