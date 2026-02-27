import {fetchPost} from "../../../util/network/fetch";
import {toggleUpdateRelationBtn} from "./relation";
import {siyuanI18n} from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import type {IBindEditContext} from "./col.editPanel.bind.types";

/** @同步豁免: UI构建 — 绑定关联列的 backRelation 开关和搜索事件 */
export const bindBackRelationEvents = (ctx: IBindEditContext): void => {
    const {menuElement, avID} = ctx;
    const backRelationElement = menuElement.querySelector('[data-type="backRelation"]');
    // 非 relation 类型列无此开关
    if (!(backRelationElement instanceof HTMLInputElement)) {
        return;
    }
    // @内联回调
    backRelationElement.addEventListener("change", () => {
        toggleUpdateRelationBtn(menuElement, avID);
    });
    const goSearchElement = menuElement.querySelector('[data-type="goSearchAV"]');
    // goSearchAV 按钮不存在时跳过
    if (!(goSearchElement instanceof HTMLElement)) {
        return;
    }
    const oldValue = JSON.parse(goSearchElement.getAttribute("data-old-value") ?? "{}");
    const inputElement = menuElement.querySelector('[data-type="colName"]');
    // colName 输入框存在时绑定 input 事件
    if (inputElement instanceof HTMLInputElement) {
        inputElement.addEventListener("input", () => {
            toggleUpdateRelationBtn(menuElement, avID);
        });
    }
    // 已有关联 AV 时获取其名称并回填
    if (oldValue.avID) {
        // @内联回调
        fetchPost("/api/av/getAttributeView", {id: oldValue.avID}, (response) => {
            fillBackRelationUI(response, goSearchElement, oldValue, avID, inputElement);
            toggleUpdateRelationBtn(menuElement, avID);
        });
        return;
    }
    // 无关联 AV 时直接更新按钮状态
    toggleUpdateRelationBtn(menuElement, avID);
};

/** @同步豁免: UI构建 — 将获取到的关联 AV 数据回填到界面元素 */
const fillBackRelationUI = (
    response: IWebSocketData,
    goSearchElement: HTMLElement,
    oldValue: { avID?: string; backKeyID?: string },
    avID: string,
    inputElement: Element | null,
): void => {
    const accelerator = goSearchElement.querySelector(".b3-menu__accelerator");
    // 回填关联数据库名称
    if (accelerator) {
        const dbName = oldValue.avID === avID
            ? siyuanI18n.thisDatabase
            : (response.data.av.name || siyuanI18n._kernel[267]);
        accelerator.textContent = dbName;
    }
    // @内联回调
    response.data.av.keyValues.find((item: { key: { id: string, name: string } }) => {
        // 非目标反向关联列跳过
        if (item.key.id !== oldValue.backKeyID) {
            return false;
        }
        const name = item.key.name || siyuanI18n._kernel[272];
        // inputElement 为 HTMLInputElement 时回填列名
        if (inputElement instanceof HTMLInputElement) {
            inputElement.setAttribute("data-old-value", name);
            inputElement.value = name;
        }
        return true;
    });
};
