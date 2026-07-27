/** 用途：桌面引导动作常量；使用范围：打开引导文档；解耦评估：经本领域网关直达协议常量。 */
import {Constants} from "./imports";
/** 用途：桌面文档导航；使用范围：桌面引导入口；解耦评估：宿主专属行为留在桌面模块。 */
import {openFileById} from "./imports";
/** 用途：笔记本准备生命周期；使用范围：桌面引导激活；解耦评估：复用唯一实现。 */
import {setNoteBook} from "./imports";
/** 用途：桌面数据迁移入口；使用范围：引导导入动作；解耦评估：明确选择桌面宿主语义。 */
import {openDesktopDataMigration} from "./imports";
/** 用途：共享引导内容；使用范围：桌面挂载；解耦评估：同目录直达共享实现。 */
import {createOnboardingElement} from "./common";
/** 用途：同步引导状态；使用范围：桌面激活；解耦评估：同目录直达共享实现。 */
import {ensureOnboarding} from "./common";
/** 用途：检查引导显示条件；使用范围：桌面打开入口；解耦评估：同目录直达共享实现。 */
import {shouldShowOnboarding} from "./common";
/** 用途：读取已初始化配置；使用范围：桌面引导；解耦评估：统一环境守卫显式处理缺失状态。 */
import {getSiyuanConfig} from "./imports";

/** 用途：约束桌面引导使用完整应用外观；使用范围：公开入口；解耦评估：不加载具体 App。 */
import type {AppFacade} from "./imports";

/** 将共享引导内容挂载到桌面编辑区，编辑区尚未建立时挂载到文档根。 */
const renderDesktopOnboarding = (app: AppFacade) => {
    const element = createOnboardingElement(app, openDesktopDataMigration);
    if (!element) {
        return;
    }
    const editorContainerElement = document.querySelector<HTMLElement>(".layout__center");
    const containerElement = editorContainerElement ?? document.body;
    if (editorContainerElement) {
        containerElement.classList.add("onboarding-container");
        element.classList.add("onboarding--editor");
    }
    containerElement.append(element);
};

/** 打开桌面引导文档并挂载操作区；由动画帧回调调用以等待当前布局写入完成。 */
const showDesktopOnboarding = (app: AppFacade) => {
    openFileById({
        app,
        id: getSiyuanConfig().onboarding.documentID,
        action: [Constants.CB_GET_FOCUSFIRST],
    });
    renderDesktopOnboarding(app);
};

/** 在桌面宿主打开引导文档，并于下一动画帧挂载引导操作区。 */
/** @同步豁免: UI构建 - 入口必须立即安排下一帧打开任务，调用方不等待异步结果且原行为为同步调度。 */
export const openDesktopOnboarding = (app: AppFacade) => {
    if (!shouldShowOnboarding()) {
        return;
    }
    window.requestAnimationFrame(() => showDesktopOnboarding(app));
};

/** 应用内核推送的桌面引导状态，完成笔记本准备后打开桌面引导。 */
export const activateDesktopOnboarding = async (app: AppFacade, onboarding: Config.IConf["onboarding"]) => {
    getSiyuanConfig().onboarding = onboarding;
    await ensureOnboarding();
    setNoteBook(() => openDesktopOnboarding(app));
};
