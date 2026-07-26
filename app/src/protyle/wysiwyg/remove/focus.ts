/** 用途：恢复前序块中的 wbr 选区；使用范围：删除前焦点迁移；解耦评估：经本职责直达网关复用唯一选区实现。 */
import {focusByWbr} from "./imports";
/** 用途：查询块的可编辑节点；使用范围：删除前焦点迁移；解耦评估：经本职责直达网关复用唯一块查询实现。 */
import {getContenteditableElement} from "./imports";
/** 用途：查询容器内最后业务块；使用范围：删除前焦点迁移；解耦评估：经本职责直达网关复用唯一块查询实现。 */
import {getLastBlock} from "./imports";
/** 用途：查询删除目标的前序业务块；使用范围：删除前焦点迁移；解耦评估：经本职责直达网关复用唯一块查询实现。 */
import {getPreviousBlock} from "./imports";
/** 用途：将 Range 定位到可编辑节点末端；使用范围：删除前焦点迁移；解耦评估：经本职责直达网关复用唯一选区实现。 */
import {setLastNodeRange} from "./imports";

/**
 * 删除当前块前，将选区移至前一个可编辑块。
 * 非向前删除操作保持原选区，由后续结构操作决定最终焦点。
 */
/** 删除流程必须在移除或重排当前 DOM 前修改调用方持有的同一个 Range，否则浏览器会使原边界失效。 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const moveToPrevious = (blockElement: Element, range: Range, isDelete: boolean) => {
    if (!isDelete) {
        return;
    }
    const previousBlockElement = getPreviousBlock(blockElement);
    if (!previousBlockElement) {
        return;
    }
    if (previousBlockElement.querySelector("wbr")) {
        return focusByWbr(previousBlockElement, range);
    }
    const previousEditElement = getContenteditableElement(getLastBlock(previousBlockElement));
    if (previousEditElement) {
        return setLastNodeRange(previousEditElement, range, false);
    }
};
