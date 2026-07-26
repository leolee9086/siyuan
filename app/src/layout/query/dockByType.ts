/** 用途：完整 Dock 领域根。使用范围：无状态 Dock 查询返回值；解耦评估：不加载具体 Dock class。 */
import type {DockDomain} from "./imports";
/** 用途：完整 Layout 领域根。使用范围：运行时容器布局身份；解耦评估：不加载具体 Layout class。 */
import type {LayoutDomain} from "./imports";
/** 用途：完整运行时布局容器。使用范围：查询输入；解耦评估：覆盖根布局、中心布局和全部 Dock。 */
import type {LayoutRuntimeDomain} from "./imports";
/** 用途：读取当前运行时布局。使用范围：保持查询函数原有无参宿主语义；解耦评估：环境读取与查询算法分离。 */
import {getSafeSiyuanLayout} from "./imports";

/** 在完整运行时布局容器中按模型类型查找所属 Dock。 @同步豁免: UI构建 */
export const getDockByType = (
    type: TDock | string,
    layout: LayoutRuntimeDomain<LayoutDomain, DockDomain> | undefined = getSafeSiyuanLayout(),
) => {
    if (!layout) {
        return undefined;
    }
    // 保持桌面布局从左、右到底部的既有优先级。
    for (const dock of [layout.leftDock, layout.rightDock, layout.bottomDock]) {
        if (dock?.data[type]) {
            return dock;
        }
    }
    return undefined;
};
