import {showMessage} from "../dialog/message";
import {getCloudURL} from "../config/util/about";
import { siyuanI18n } from "./siyuanEnvironments/i18n.getI18n.environment";

export const needSubscribe = (tip = siyuanI18n._kernel[29]) => {
    if (window.siyuan.user && (window.siyuan.user.userSiYuanProExpireTime === -1 || window.siyuan.user.userSiYuanProExpireTime > 0)) {
        return false;
    }
    if (tip) {
        if (tip === siyuanI18n._kernel[29] && window.siyuan.config.system.container === "ios") {
            showMessage(siyuanI18n._kernel[122]);
        } else {
            if (tip === siyuanI18n._kernel[29]) {
                tip = siyuanI18n._kernel[29].replaceAll("${accountServer}", getCloudURL(""));
            }
            showMessage(tip);
        }
    }
    return true;
};

export const isPaidUser = () => {
    return window.siyuan.user && (0 === window.siyuan.user.userSiYuanSubscriptionStatus || 1 === window.siyuan.user.userSiYuanOneTimePayStatus);
};
