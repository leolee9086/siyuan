/**
 * 用途：承接窗口级切换对话框中的点击事件，执行 dock 或页签切换并关闭对话框。
 * 使用范围：仅供 `windowKeyDown/subset/switchDialog.factory.ts` 在切换对话框挂载后绑定点击与右键菜单事件。
 */

/**
 * 用途：引入 `keydown` 目录网关中的应用实例类型。
 * 使用范围：仅用于当前文件标注切换对话框点击处理器的 `app` 入参。
 * 解耦评估：这是纯类型依赖，不形成运行时耦合；继续通过同层 `imports.ts` 收敛路径最稳妥。
 */
import type { AppFacade } from "./imports";

/**
 * 用途：引入卡片抽认入口。
 * 使用范围：仅用于当前文件处理切换对话框中 `riffCard` 项的点击动作。
 * 解耦评估：这是明确业务入口，继续经由同层 `imports.ts` 转发可避免业务文件散落跨层路径。
 */
import { openCard } from "./imports";

/**
 * 用途：引入全部页签列表访问器。
 * 使用范围：仅用于当前文件按 `data-id` 查找被点击的目标页签并执行切换。
 * 解耦评估：页签枚举能力属于布局系统稳定边界，经同层 `imports.ts` 收敛路径后已足够解耦。
 */
import { getAllTabs } from "./imports";

/**
 * 用途：引入 dock 查询工具。
 * 使用范围：仅用于当前文件在点击 dock 类列表项时切换对应 dock 面板。
 * 解耦评估：布局查询能力属于稳定边界，经同层 `imports.ts` 转发已把路径耦合压缩到单点。
 */
import { getDockByType } from "./imports";

/**
 * 用途：引入切换对话框共享状态读取入口。
 * 使用范围：仅用于当前文件读取当前激活的切换对话框实例。
 * 解耦评估：共享 UI 状态已经收敛到单点模块，直接读取该入口比继续经 `windowKeyDown.ts` 回传更低耦合。
 */
import { switchDialog } from "./windowKeyDown/switchDialog.global";

/**
 * 用途：引入切换对话框共享状态写入入口。
 * 使用范围：仅用于当前文件在点击完成后清空当前切换对话框实例。
 * 解耦评估：共享 UI 状态写入应集中到单点，以避免多个协作者散改共享变量。
 */
import { setSwitchDialog } from "./windowKeyDown/switchDialog.global";

/**
 * 作用：把鼠标事件目标收敛为可安全读取的 HTML 元素。
 * 意图：避免点击处理流程重复处理 `event.target` 的空值与类型保护。
 * 调用时机：仅在 `switchDialogEvent()` 开始时调用一次。
 * 问题/改进：当前在非 HTMLElement 场景下直接返回 `null`；若未来需要支持 SVG 子节点，可在这里继续扩展。
 */
const resolveMouseTarget = (event: MouseEvent) => event.target instanceof HTMLElement ? event.target : null;

/**
 * 作用：关闭当前切换对话框并同步清空共享状态。
 * 意图：把销毁实例与状态清理收敛到单个函数，避免点击分支重复书写。
 * 调用时机：仅在点击 dock 项或页签项之后调用。
 * 问题/改进：当前仍依赖共享单实例模型；若未来需要多窗口并发，可进一步按窗口 ID 管理。
 */
const closeSwitchDialog = () => {
    switchDialog?.destroy();
    setSwitchDialog(undefined);
};

/**
 * 作用：处理切换对话框中的 dock 类列表项点击。
 * 意图：把 `riffCard` 特例与普通 dock 切换分支从主事件处理器中抽离，保持控制流扁平。
 * 调用时机：仅在点击列表项且其携带 `data-type` 时调用。
 * 问题/改进：当前仍直接按字符串判断 `riffCard`；若未来 dock 类型继续增加，可进一步改为映射表。
 */
const handleDockSelection = (app: AppFacade, currentType: string) => {
    // 场景：`riffCard` 不是普通 dock，而是独立业务入口，需要继续走既有打开逻辑。
    if (currentType === "riffCard") {
        openCard(app);
        return;
    }
    getDockByType(currentType).toggleModel(currentType, true);
};

/**
 * 作用：按点击项的页签 ID 切换到目标页签。
 * 意图：把页签查找与切换逻辑从主事件处理器中抽离，避免内联回调过长。
 * 调用时机：仅在点击列表项且其不携带 `data-type` 时调用。
 * 问题/改进：当前继续线性扫描全部页签；若未来页签数量继续增长，可考虑按 ID 建立索引。
 */
const switchToClickedTab = (currentId: string | null) => {
    for (const item of getAllTabs()) {
        // 场景：找到与被点击列表项 `data-id` 对应的页签后，需要沿用既有切换与标题刷新逻辑。
        if (item.id === currentId) {
            item.parent.switchTab(item.headElement);
            item.parent.showHeading();
            return;
        }
    }
};

/**
 * 作用：处理切换对话框中的点击事件。
 * 意图：点击列表项后，根据项类型切换 dock 或页签，并在成功处理后关闭切换对话框。
 * 调用时机：由切换对话框工厂在对话框创建后绑定到 `click` 与 `contextmenu` 事件。
 * 问题/改进：当前仍依赖 DOM 结构中 `.b3-list-item` 与 `data-type/data-id` 约定；若未来对话框改为组件化渲染，可替换为更显式的数据绑定。
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const switchDialogEvent = (app: AppFacade, event: MouseEvent) => {
    event.preventDefault();
    const target = resolveMouseTarget(event);

    // 场景：只有存在切换对话框实例且点击目标可解析为 HTMLElement 时，才继续处理列表项点击。
    if (!switchDialog || !target) {
        return;
    }

    let currentTarget: HTMLElement | null = target;
    while (currentTarget && currentTarget !== switchDialog.element) {
        // 场景：只有点击落在列表项上时才执行切换动作，其余节点继续向上寻找最近的列表项容器。
        if (!currentTarget.classList.contains("b3-list-item")) {
            currentTarget = currentTarget.parentElement;
            continue;
        }

        const currentType = currentTarget.getAttribute("data-type");
        // 场景：带 `data-type` 的列表项表示 dock 入口，需按 dock 分支处理。
        if (currentType) {
            handleDockSelection(app, currentType);
            closeSwitchDialog();
            return;
        }

        switchToClickedTab(currentTarget.getAttribute("data-id"));
        closeSwitchDialog();
        return;
    }
};
