import { showMessage } from "../dialog/message";
import { getCloudURL } from "../config/util/about";
import { siyuanI18n } from "./siyuanEnvironments/i18n.getI18n.environment";
import { getSafeSiyuanUser, getSiyuanConfig } from "./siyuanEnvironments/getSiyuanConfig.environment";

/**
 * 显示订阅提示消息
 * 根据平台（iOS 或其他）和提示类型显示不同的消息
 *
 * @param tip 提示消息内容
 */
const showTipMessage = (tip: string): void => {
    const config = getSiyuanConfig();
    const isIOS = config.system.container === "ios";
    const isDefaultTip = tip === siyuanI18n._kernel[29];

    if (isDefaultTip && isIOS) {
        showMessage(siyuanI18n._kernel[122]);
        return;
    }

    if (isDefaultTip) {
        const formattedTip = tip.replaceAll("${accountServer}", getCloudURL(""));
        showMessage(formattedTip);
        return;
    }

    showMessage(tip);
};

/**
 * 检查用户是否需要订阅
 *
 * @description 判断当前用户是否为 Pro 用户，如果不是则显示订阅提示
 * @param tip 可选的提示消息，默认使用系统预设的订阅提示
 * @returns 如果需要订阅返回 true，否则返回 false
 *
 * @remarks
 * - 用户未登录时视为需要订阅
 * - Pro 用户（userSiYuanProExpireTime === -1 或 > 0）不需要订阅
 * - 在 transaction.ts 的移动端同步逻辑中被调用
 */
export const needSubscribe = (tip = siyuanI18n._kernel[29]) => {
    const user = getSafeSiyuanUser();
    const isProUser = user && (user.userSiYuanProExpireTime === -1 || user.userSiYuanProExpireTime > 0);

    // Pro 用户不需要订阅，直接返回
    if (isProUser) {
        return false;
    }

    // 未登录用户或非 Pro 用户需要订阅，显示提示
    if (tip) {
        showTipMessage(tip);
    }
    return true;
};

/**
 * 检查用户是否为付费用户
 *
 * @description 判断当前用户是否有有效的订阅或一次性付费
 * @returns 如果是付费用户返回 true，否则返回 false
 *
 * @remarks
 * - 用户未登录时返回 false
 * - 订阅状态为 0 或一次性付费状态为 1 时视为付费用户
 * - 在 transaction.ts 的移动端同步逻辑中被调用
 */
export const isPaidUser = () => {
    const user = getSafeSiyuanUser();
    // 用户未登录时，视为未付费用户
    if (!user) {
        return false;
    }
    return 0 === user.userSiYuanSubscriptionStatus || 1 === user.userSiYuanOneTimePayStatus;
};
