import {Constants} from "../../constants";
import {isMobile} from "../../util/functions";

/** 更新账户设置项、会员状态和支付区域的可见性。 */
export const updateAccountSwitchesVisibility = (accountSettingsRoot: Element) => {
    const user = window.siyuan.user;
    accountSettingsRoot.querySelector(`#${CSS.escape("account.displayTitle")}`)?.closest(".config-item")?.classList.toggle("fn__none", !user || user.userTitles.length === 0);
    accountSettingsRoot.querySelector(`#${CSS.escape("account.displayVIP")}`)?.closest(".config-item")?.classList.toggle("fn__none", !user);
    accountSettingsRoot.querySelector("#configAccountPayment")?.classList.toggle("fn__none", !user);
};

const genVIPIconHTML = (className = "") =>
    `<svg${className ? ` class="${className}"` : ""}><use xlink:href="#iconVIP"></use></svg>`;

const genToolbarItemHTML = (ariaLabel: string, svg: string) =>
    `<div class="toolbar__item ariaLabel" aria-label="${ariaLabel}">${svg}</div>`;

/** 刷新桌面顶栏会员和用户称号显示。 */
export const onSetaccount = () => {
    if (isMobile()) {
        return;
    }
    const toolbarVIPEl = document.getElementById("toolbarVIP");
    if (!toolbarVIPEl) {
        return;
    }
    const parts: string[] = [];
    if (window.siyuan.config.account.displayVIP) {
        if (!window.siyuan.user) {
            parts.push(genToolbarItemHTML(window.siyuan.languages.freeSub, genVIPIconHTML("ft__error")));
        } else {
            const isOneTimePay = window.siyuan.user.userSiYuanOneTimePayStatus === 1;
            if (window.siyuan.user.userSiYuanProExpireTime === -1) {
                parts.push(genToolbarItemHTML(window.siyuan.languages.account12, Constants.SIYUAN_IMAGE_VIP));
            } else if (window.siyuan.user.userSiYuanProExpireTime > 0) {
                if (window.siyuan.user.userSiYuanSubscriptionPlan === 2) {
                    parts.push(genToolbarItemHTML(window.siyuan.languages.account3, genVIPIconHTML()));
                } else {
                    parts.push(genToolbarItemHTML(window.siyuan.languages.account10, genVIPIconHTML("ft__secondary")));
                }
            } else if (window.siyuan.user.userSiYuanSubscriptionStatus === 2 && !isOneTimePay) {
                parts.push(genToolbarItemHTML(window.siyuan.languages.accountSubscriptionExpired, genVIPIconHTML("ft__error")));
            } else if (window.siyuan.user.userSiYuanSubscriptionStatus === -1 && !isOneTimePay) {
                parts.push(genToolbarItemHTML(window.siyuan.languages.freeSub, genVIPIconHTML("ft__error")));
            }
            if (isOneTimePay) {
                parts.push(genToolbarItemHTML(window.siyuan.languages.onepay, genVIPIconHTML("ft__success")));
            }
        }
    }

    if (window.siyuan.config.account.displayTitle && window.siyuan.user) {
        window.siyuan.user.userTitles.forEach(item => {
            parts.push(genToolbarItemHTML(`${item.name}：${item.desc}`, item.icon));
        });
    }

    toolbarVIPEl.innerHTML = parts.join("");
};
