/**
 * 用途：发送锁屏后的注销鉴权请求。
 * 使用范围：仅在当前文件的锁屏流程中使用，分别覆盖移动端即时注销和桌面端布局导出完成后的注销回调。
 * 解耦评估：网络请求能力已经在 [`imports.ts`](app/src/dialog/processSystem/imports.ts) 网关中收敛；进一步改为依赖注入虽可继续降低耦合，但当前函数由系统流程直接触发，注入收益有限。
 */
import { fetchPost } from "./imports";
/**
 * 用途：在桌面端锁屏前导出布局并注册完成回调。
 * 使用范围：仅用于当前文件的非移动端锁屏分支，不负责移动端滚动位置保存。
 * 解耦评估：布局序列化属于基础设施能力，当前通过 [`imports.ts`](app/src/dialog/processSystem/imports.ts) 转发已避免业务文件直接跨层依赖；若未来重构为命令总线，可由更高层替换实现。
 */
import { exportLayout } from "./imports";
/**
 * 用途：提供锁屏流程参数中的应用实例类型。
 * 使用范围：仅用于 [`lockScreen`](app/src/dialog/processSystem/lockScreen.ts:18) 的参数类型标注。
 * 解耦评估：类型导入不形成运行时耦合，经 [`imports.ts`](app/src/dialog/processSystem/imports.ts) 统一转发后已满足目录边界约束。
 */
import type { AppFacade } from "./imports";
/**
 * 用途：判断当前锁屏流程是否运行在移动端。
 * 使用范围：仅用于当前文件区分移动端滚动保存流程与桌面端布局导出流程。
 * 解耦评估：平台判断属于环境基础能力，当前通过 [`imports.ts`](app/src/dialog/processSystem/imports.ts) 转发已足够；若调用链未来天然携带平台上下文，可再考虑通过参数传入。
 */
import { isMobile } from "./imports";
/**
 * 用途：获取移动端当前主编辑器实例。
 * 使用范围：仅用于当前文件在移动端锁屏前保存滚动位置。
 * 解耦评估：该能力本质上是对全局环境的受控访问，继续通过 [`imports.ts`](app/src/dialog/processSystem/imports.ts) 间接依赖，比在业务代码中直接访问全局对象更合理。
 */
import { getMobileEditor } from "./imports";
/**
 * 用途：保存移动端当前编辑器的滚动状态。
 * 使用范围：仅用于当前文件的移动端锁屏分支。
 * 解耦评估：滚动位置持久化与编辑器实现强相关，不宜在业务层重复拼装，当前通过 [`imports.ts`](app/src/dialog/processSystem/imports.ts) 收敛依赖已是合适边界。
 */
import { saveScroll } from "./imports";
/**
 * 用途：安全读取只读配置，避免锁屏在不可编辑模式下误执行。
 * 使用范围：仅用于当前文件的锁屏前置校验。
 * 解耦评估：配置读取已被 environment 层封装，通过 [`imports.ts`](app/src/dialog/processSystem/imports.ts) 使用可避免业务层直接耦合全局对象。
 */
import { getSafeSiyuanConfig } from "./imports";
/**
 * 用途：读取当前是否为发布模式。
 * 使用范围：仅用于当前文件的锁屏前置校验，发布模式下直接跳过锁屏流程。
 * 解耦评估：发布模式是全局运行时状态，当前调用链未向该函数显式传递上下文，因此继续通过 [`imports.ts`](app/src/dialog/processSystem/imports.ts) 访问是现阶段最小改动且符合 lint 的做法。
 */
import { getSiyuanIsPublish } from "./imports";

/**
 * 作用：触发锁屏流程，并在锁屏前广播插件事件、保存移动端滚动位置、执行注销鉴权请求。
 * 意图：保证锁屏前的界面状态与插件状态被正确落盘，避免移动端直接退出鉴权后丢失当前阅读位置。
 * 调用时机：在用户主动执行锁屏操作时由系统流程调用。
 * 问题/改进：桌面端仍依赖 `exportLayout` 的回调时机完成注销；如果未来需要统一移动端与桌面端的提交确认语义，可进一步收敛为显式 Promise 链路。
 */
export const lockScreen = async (app: AppFacade) => {
    const siyuanConfig = getSafeSiyuanConfig();
    if (siyuanConfig?.readonly || getSiyuanIsPublish()) {
        return;
    }

    for (const item of app.plugins) {
        item.eventBus.emit("lock-screen");
    }

    const mobileEditor = isMobile() ? getMobileEditor() : undefined;

    // 移动端锁屏前需要先确认当前编辑器存在并保存滚动位置，否则注销后重新进入时会丢失阅读上下文。
    if (isMobile() && !mobileEditor) {
        return;
    }
    if (mobileEditor) {
        await saveScroll(mobileEditor.protyle);
        fetchPost("/api/system/logoutAuth");
        return;
    }

    exportLayout({
        errorExit: false,
        /**
         * 通过后端接口触发登出
         */
        cb: () => {
            fetchPost("/api/system/logoutAuth");
        },
    });
};

