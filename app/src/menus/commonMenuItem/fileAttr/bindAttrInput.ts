/**
 * 用途：绑定属性输入框的变更事件
 * 作用：当输入框值改变时自动保存到块属性
 * 意图：从 index.ts 提取为独立文件，打破 index.ts ↔ openFileAttr.ts/.handlers.ts 的循环依赖
 * 调用时机：创建属性输入框时，由 openFileAttr.ts 和 openFileAttr.handlers.ts 调用
 * 使用范围：openFileAttr.ts、openFileAttr.handlers.ts 中创建属性输入框后绑定 change 事件
 * 解耦评估：函数体很短且逻辑固定，当前直接调用不会造成紧耦合；后续若需变更保存逻辑可统一修改此文件
 * @同步豁免: 需要绝对同步的DOM访问 - 事件监听器绑定必须同步
 */
import {fetchPost} from "./imports";

// @柯里化
/** @同步豁免: 需要绝对同步的DOM访问 - 事件监听器绑定必须同步 */
export const bindAttrInput = (inputElement: HTMLInputElement, id: string) => {
    // @内联回调
    inputElement.addEventListener("change", () => {
        const attrName = inputElement.dataset.name || "";
        fetchPost("/api/attr/setBlockAttrs", {
            id,
            attrs: { [attrName]: inputElement.value }
        });
    });
};
