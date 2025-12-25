import {showMessage} from "../dialog/message";
import {getCloudURL} from "../config/util/about";
import { siyuanI18n } from "./siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanUser, getSiyuanConfig } from "./siyuanEnvironments/getSiyuanConfig.environment";

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

export const needSubscribe = (tip = siyuanI18n._kernel[29]) => {
    const user = getSiyuanUser();
    const isProUser = user && (user.userSiYuanProExpireTime === -1 || user.userSiYuanProExpireTime > 0);

    if (isProUser) {
        return false;
    }

    if (tip) {
        showTipMessage(tip);
    }

    return true;
};

export const isPaidUser = () => {
    const user = getSiyuanUser();
    return user && (0 === user.userSiYuanSubscriptionStatus || 1 === user.userSiYuanOneTimePayStatus);
};
