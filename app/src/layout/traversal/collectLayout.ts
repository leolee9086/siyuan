/** 用途：布局遍历结构契约；使用范围：本模块的窗口和页签收集算法；解耦评估：纯领域类型，不依赖 Layout/Tab/Wnd class。 */
import type {ILayoutTraversalBranch} from "./layoutTraversal.types";
/** 用途：布局页签身份契约；使用范围：保留调用方具体页签类型；解耦评估：泛型参数避免导入具体 Tab class。 */
import type {ILayoutTraversalTab} from "./layoutTraversal.types";
/** 用途：布局窗口身份契约；使用范围：保留调用方具体窗口类型；解耦评估：泛型参数避免导入具体 Wnd class。 */
import type {ILayoutTraversalWindow} from "./layoutTraversal.types";

/** 递归收集布局树中的窗口，并保留调用方窗口身份。 @同步豁免: 性能考虑 */
export function collectLayoutWindows<
    TTab extends ILayoutTraversalTab,
    TWindow extends ILayoutTraversalWindow<TTab>,
>(layout: ILayoutTraversalBranch<TTab, TWindow>, windows: TWindow[]) {
    for (const child of layout.children ?? []) {
        // 窗口节点持有标签栏元素；普通布局分支只继续嵌套子节点。
        if ("headersElement" in child) {
            windows.push(child);
            continue;
        }
        collectLayoutWindows(child, windows);
    }
}

/** 递归收集布局树中各窗口的页签，并保留调用方页签身份。 @同步豁免: 性能考虑 */
export function collectLayoutTabs<
    TTab extends ILayoutTraversalTab,
    TWindow extends ILayoutTraversalWindow<TTab>,
>(layout: ILayoutTraversalBranch<TTab, TWindow>, tabs: TTab[]) {
    for (const child of layout.children ?? []) {
        // 到达窗口节点后直接按原顺序收集其页签，布局分支则继续递归。
        if ("headersElement" in child) {
            tabs.push(...child.children);
            continue;
        }
        collectLayoutTabs(child, tabs);
    }
}
