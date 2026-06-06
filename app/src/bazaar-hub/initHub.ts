/** 用途：DOM 守卫能力。使用范围：initHub 入口校验容器节点。解耦评估：基础工具依赖，通过目录网关导入可降低路径耦合。 */
import { isHTMLElement } from "./imports";

/** 用途：Custom Tab 类型定义。使用范围：initHub 入口参数约束。 */
import type { Custom } from "./imports";

/** 用途：Hub 页面挂载控制器。使用范围：initHub 入口把业务逻辑委托给内部模块。解耦评估：按关注点拆分后，根文件只保留生命周期入口，降低文件复杂度。 */
import { mountBazaarHub } from "./internal/hubController";

/** 用途：初始化 bazaar hub 页签入口。意图：只负责做容器校验并挂载 hub 控制器。调用时机：register.ts 注册回调触发。问题/改进：生命周期入口保持轻量，便于后续替换控制器实现。 @同步豁免: UI构建 */
/** 导出 initBazaarHub 供 Tab 注册中心调用 */
export function initBazaarHub(model: Custom) {
    if (!isHTMLElement(model.element)) {
        return;
    }
    mountBazaarHub(model);
}
