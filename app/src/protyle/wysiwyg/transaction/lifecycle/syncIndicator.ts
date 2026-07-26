/** 用途：读取移动端构建标记；使用范围：事务同步指示器；解耦评估：经本阶段网关直达平台声明。 */
import {isMobile} from "./imports";
/** 用途：读取付费状态；使用范围：官方同步提供方门禁；解耦评估：经本阶段网关直达账号能力。 */
import {isPaidUser} from "./imports";
/** 用途：读取订阅状态；使用范围：第三方同步提供方门禁；解耦评估：经本阶段网关直达账号能力。 */
import {needSubscribe} from "./imports";

/**
 * 在移动端事务开始时显示待同步状态；沿用事务原有提供方、订阅与仓库密钥判断。
 * @同步豁免: 需要绝对同步的DOM访问
 * 指示器必须在事务本地处理和网络排队前立即更新，避免用户看到滞后的同步状态。
 */
export const markTransactionSyncPending = () => {
    // 桌面端原逻辑由首个 isMobile 条件短路，不读取同步配置和账号状态。
    if (!isMobile) {
        return;
    }
    const config = window.siyuan.config;
    const canUseProvider = (config.sync.provider !== 0 && isPaidUser()) ||
        (config.sync.provider === 0 && !needSubscribe(""));
    // 提供方不可用、仓库未初始化或同步关闭时保持指示器原状态。
    if (!canUseProvider || !config.repo.key || !config.sync.enabled) {
        return;
    }
    const syncElement = document.getElementById("toolbarSync");
    // 满足显示条件却缺少移动端工具栏表示宿主初始化不完整，必须显式失败。
    if (!syncElement) {
        throw new Error("Transaction sync indicator requires #toolbarSync");
    }
    syncElement.classList.remove("fn__none");
};
