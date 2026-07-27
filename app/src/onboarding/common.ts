/** 用途：持久化引导关闭；使用范围：共享引导业务；解耦评估：经本领域网关直达网络实现。 */
import {fetchPost} from "./imports";
/** 用途：确认引导状态；使用范围：共享引导业务；解耦评估：经本领域网关直达网络实现。 */
import {fetchSyncPost} from "./imports";
/** 用途：打开用户指南；使用范围：帮助动作；解耦评估：经本领域网关直达唯一实现。 */
import {mountHelp} from "./imports";
/** 用途：启动同步引导；使用范围：登录与同步动作；解耦评估：经本领域网关直达唯一实现。 */
import {syncGuide} from "./imports";
/** 用途：打开同步设置；使用范围：未登录用户；解耦评估：经本领域网关直达完整配置入口。 */
import {openSetting} from "./imports";
/** 用途：判断同步资格；使用范围：登录成功分派；解耦评估：经本领域网关直达统一规则。 */
import {isPaidUser} from "./imports";
/** 用途：访问已初始化配置；使用范围：引导状态读写；解耦评估：经本领域网关直达环境守卫。 */
import {getSiyuanConfig} from "./imports";
/** 用途：约束共享业务使用完整应用外观；使用范围：同步与设置入口；解耦评估：纯类型不加载具体 App。 */
import type {AppFacade} from "./imports";
/** 用途：约束数据迁移调用参数；使用范围：引导导入动作；解耦评估：纯类型不依赖宿主实现。 */
import type {DataMigrationOptions} from "./imports";
/** 用途：取得统一引导生命周期状态；使用范围：登录与同步监听；解耦评估：同目录直达注册表唯一实现。 */
import {getOnboardingLifecycleState} from "./lifecycle/registry";
/** 用途：释放统一引导生命周期状态；使用范围：引导关闭；解耦评估：同目录直达注册表唯一实现。 */
import {resetOnboardingLifecycleState} from "./lifecycle/registry";
/** 用途：取得已初始化语言环境；使用范围：共享引导 DOM；解耦评估：同目录守卫显式处理缺失语言包。 */
import {getOnboardingLanguages} from "./onboarding.guard";

/** 向内核确认新用户引导状态；应用启动与内核推送引导配置后调用。 */
export const ensureOnboarding = async () => {
    const config = getSiyuanConfig();
    const onboarding = config.onboarding;
    if (!onboarding?.newUser || onboarding.dismissed || config.readonly || window.siyuan.isPublish) {
        return;
    }
    try {
        const response = await fetchSyncPost("/api/system/ensureOnboarding", {});
        // 只有内核确认成功时才用持久化状态替换当前启动配置。
        if (response.code === 0) {
            config.onboarding = response.data;
        }
    } catch (error) {
        console.warn("ensure onboarding failed", error);
    }
};

/** 判断引导配置已经完成初始化且当前用户尚未关闭引导。 */
/** @同步豁免: 生命周期 - 桌面和移动入口必须在挂载前立即读取同一配置快照并据返回值决定后续 UI 构建。 */
export const shouldShowOnboarding = () => {
    const onboarding = getSiyuanConfig().onboarding;
    return onboarding?.newUser &&
        onboarding.state === "completed" &&
        onboarding.documentID &&
        !onboarding.dismissed;
};

/** 完成引导关闭、宿主清理与内核持久化。 */
const dismissOnboarding = () => {
    resetOnboardingLifecycleState();
    const onboardingElement = document.querySelector(".onboarding");
    onboardingElement?.parentElement?.classList.remove("onboarding-container");
    onboardingElement?.remove();
    getSiyuanConfig().onboarding.dismissed = true;
    fetchPost("/api/system/dismissOnboarding", {});
};

/** 启动同步并在内核报告成功后关闭当前引导实例。 */
const syncAndDismissOnSuccess = (app: AppFacade, dismiss: () => void) => {
    const state = getOnboardingLifecycleState();
    if (state.pendingSyncHandler) {
        window.removeEventListener("siyuan-sync-success", state.pendingSyncHandler);
    }
    state.pendingSyncHandler = () => {
        delete state.pendingSyncHandler;
        dismiss();
    };
    window.addEventListener("siyuan-sync-success", state.pendingSyncHandler, {once: true});
    syncGuide(app);
};

/** 根据当前账户状态直接同步或打开登录设置，并保持成功后的关闭语义。 */
const loginAndSync = (app: AppFacade, dismiss: () => void) => {
    // 已登录付费用户可以直接同步，并在同步成功后关闭引导。
    if (window.siyuan.user && isPaidUser()) {
        syncAndDismissOnSuccess(app, dismiss);
        return;
    }
    // 已登录非付费用户仍显示同步引导，但不等待不会发生的付费同步成功事件。
    if (window.siyuan.user) {
        syncGuide(app);
        return;
    }
    const state = getOnboardingLifecycleState();
    if (state.pendingLoginHandler) {
        window.removeEventListener("siyuan-login-success", state.pendingLoginHandler);
    }
    state.pendingLoginHandler = () => {
        delete state.pendingLoginHandler;
        // 登录完成后仅付费账户进入同步并关闭的流程。
        if (isPaidUser()) {
            syncAndDismissOnSuccess(app, dismiss);
        }
    };
    window.addEventListener("siyuan-login-success", state.pendingLoginHandler, {once: true});
    openSetting(app, "sync");
};

/** 根据引导按钮分派关闭、导入、同步和帮助动作。 */
const handleOnboardingAction = (
    target: HTMLElement,
    actions: {
        app: AppFacade;
        openDataMigration: (options: DataMigrationOptions) => void;
        dismiss: () => void;
    },
) => {
    // 关闭动作只结束当前引导，不执行其它业务入口。
    if (target.dataset.type === "close") {
        actions.dismiss();
        return;
    }
    // 导入动作由当前桌面或移动宿主提供对应的数据迁移入口。
    if (target.dataset.type === "import") {
        actions.openDataMigration({
            mode: "onboarding",
            notebookID: getSiyuanConfig().onboarding.notebookID,
            onContentImportComplete: actions.dismiss,
        });
        return;
    }
    // 同步动作需要完整 AppFacade 进入设置或同步流程。
    if (target.dataset.type === "sync") {
        loginAndSync(actions.app, actions.dismiss);
        return;
    }
    // 帮助动作打开用户指南后即完成引导。
    if (target.dataset.type === "guide") {
        mountHelp();
        actions.dismiss();
    }
};

/** 收窄 DOM 点击目标后分派引导动作；仅处理当前引导元素内带 data-type 的控件。 */
const handleOnboardingClick = (
    event: Event,
    actions: {
        app: AppFacade;
        openDataMigration: (options: DataMigrationOptions) => void;
        dismiss: () => void;
    },
) => {
    if (!(event.target instanceof HTMLElement)) {
        return;
    }
    const target = event.target.closest<HTMLElement>("[data-type]");
    if (target) {
        handleOnboardingAction(target, actions);
    }
};

/** 创建宿主无关的新用户引导内容；具体挂载位置和移动键盘生命周期由宿主模块负责。 */
/** @同步豁免: UI构建 - 调用方必须在当前挂载流程立即获得 HTMLElement 或空结果并完成宿主 DOM 装配。 */
export const createOnboardingElement = (
    app: AppFacade,
    openDataMigration: (options: DataMigrationOptions) => void,
) => {
    if (!shouldShowOnboarding() || document.querySelector(".onboarding")) {
        return;
    }
    const element = document.createElement("section");
    const languages = getOnboardingLanguages();
    element.className = "onboarding";
    element.innerHTML = `<button class="onboarding__close" data-type="close" aria-label="${languages.close}">
    <svg><use xlink:href="#iconCloseRound"></use></svg>
</button>
<div class="onboarding__title">&#x1F389; ${languages.onboardingWelcome}</div>
<div class="onboarding__desc">${languages.onboardingDescription}</div>
<button class="b3-button b3-button--outline fn__block" data-type="import">
    <svg><use xlink:href="#iconDownload"></use></svg>${languages.importExistingData}
</button>
<button class="b3-button b3-button--outline fn__block" data-type="sync">
    <svg><use xlink:href="#iconCloud"></use></svg>${languages.loginAndSync}
</button>
<button class="b3-button b3-button--outline fn__block" data-type="guide">
    <svg><use xlink:href="#iconHelp"></use></svg>${languages.userGuide}
</button>`;
    element.addEventListener("click", (event) => handleOnboardingClick(event, {
        app,
        openDataMigration,
        dismiss: dismissOnboarding,
    }));
    return element;
};
