/** 用途：移动文档打开动作常量；使用范围：移动引导入口；解耦评估：经本领域网关直达协议常量。 */
import {Constants} from "./imports";
/** 用途：移动文档导航；使用范围：移动引导入口；解耦评估：宿主专属行为留在移动模块。 */
import {openMobileFileById} from "./imports";
/** 用途：笔记本准备生命周期；使用范围：移动引导激活；解耦评估：复用唯一实现。 */
import {setNoteBook} from "./imports";
/** 用途：移动数据迁移入口；使用范围：引导导入动作；解耦评估：明确选择移动宿主语义。 */
import {openMobileDataMigration} from "./imports";
/** 用途：共享引导内容；使用范围：移动挂载；解耦评估：同目录直达共享实现。 */
import {createOnboardingElement} from "./common";
/** 用途：同步引导状态；使用范围：移动激活；解耦评估：同目录直达共享实现。 */
import {ensureOnboarding} from "./common";
/** 用途：检查引导显示条件；使用范围：移动打开入口；解耦评估：同目录直达共享实现。 */
import {shouldShowOnboarding} from "./common";
/** 用途：读取已初始化配置；使用范围：移动引导；解耦评估：统一环境守卫显式处理缺失状态。 */
import {getSiyuanConfig} from "./imports";
/** 用途：取得完整引导生命周期状态；使用范围：移动键盘监听；解耦评估：同目录直达统一注册表。 */
import {getOnboardingLifecycleState} from "./lifecycle/registry";

/** 用途：约束移动引导使用完整应用外观；使用范围：公开入口；解耦评估：不加载具体 App。 */
import type {AppFacade} from "./imports";

/** 在移动宿主挂载引导内容、绑定软键盘状态并打开引导文档。 */
/** @同步豁免: UI构建 - 调用方依据布尔返回值立即决定是否继续构建移动空白页，引导 DOM 和文档打开必须在当前生命周期同步完成。 */
export const openMobileOnboarding = (app: AppFacade) => {
    if (!shouldShowOnboarding()) {
        return false;
    }
    const element = createOnboardingElement(app, openMobileDataMigration);
    if (!element) {
        return false;
    }
    const state = getOnboardingLifecycleState();
    state.mobileKeyboardHandler = (event: Event) => {
        if (!(event instanceof CustomEvent) || typeof event.detail !== "boolean") {
            throw new TypeError("Mobile keyboard event detail must be boolean");
        }
        element.classList.toggle("onboarding--keyboard", event.detail);
    };
    window.addEventListener("siyuan-mobile-keyboard-change", state.mobileKeyboardHandler);
    document.body.append(element);
    openMobileFileById(app, getSiyuanConfig().onboarding.documentID, [Constants.CB_GET_CONTEXT]);
    return true;
};

/** 应用内核推送的移动引导状态，完成笔记本准备后打开移动引导。 */
export const activateMobileOnboarding = async (app: AppFacade, onboarding: Config.IConf["onboarding"]) => {
    getSiyuanConfig().onboarding = onboarding;
    await ensureOnboarding();
    setNoteBook(() => openMobileOnboarding(app));
};
