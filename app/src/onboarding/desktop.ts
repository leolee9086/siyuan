/** 用途：桌面引导动作常量；使用范围：打开引导文档；解耦评估：经本领域网关直达协议常量。 */
import {Constants} from "./imports";
/** 用途：桌面文档导航；使用范围：桌面引导入口；解耦评估：宿主专属行为留在桌面模块。 */
import {openFileById} from "./imports";
/** 用途：读取当前编辑器页签；使用范围：避免会话恢复时重复打开引导文档。 */
import {getAllTabs} from "./imports";
/** 用途：读取启动 URI 文档标识；使用范围：避免 URI 导航与引导文档竞争。 */
import {parseUriInfo} from "./imports";
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

let openingOnboardingDocument = false;

/** 打开桌面引导文档并挂载操作区；延时回调会重新检查状态，避免与会话恢复竞争。 */
const showDesktopOnboarding = (app: AppFacade) => {
    if (!shouldShowOnboarding()) {
        return;
    }
    renderDesktopOnboarding(app);
    if (getAllTabs("Editor").length > 0 || parseUriInfo().id || openingOnboardingDocument) {
        return;
    }
    openingOnboardingDocument = true;
    void openFileById({
        app,
        id: getSiyuanConfig().onboarding.documentID,
        action: [Constants.CB_GET_FOCUSFIRST],
    }).finally(() => {
        openingOnboardingDocument = false;
    }).catch((error: unknown) => {
        console.warn("open onboarding document failed", error);
    });
};

/** 在桌面宿主延时检查并打开引导，给布局与会话恢复留出完成时间。 */
/** @同步豁免: UI构建 - 入口立即安排异步打开任务，调用方不等待结果。 */
export const openDesktopOnboarding = (app: AppFacade) => {
    if (!shouldShowOnboarding()) {
        return;
    }
    window.setTimeout(() => showDesktopOnboarding(app));
};

/** 应用内核推送的桌面引导状态，完成笔记本准备后打开桌面引导。 */
export const activateDesktopOnboarding = async (app: AppFacade, onboarding: Config.IConf["onboarding"]) => {
    getSiyuanConfig().onboarding = onboarding;
    await ensureOnboarding();
    setNoteBook(() => openDesktopOnboarding(app));
};
