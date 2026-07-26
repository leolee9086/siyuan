/** 用途：声明完整单步请求与结果。使用范围：纯操作生成。解耦评估：纯类型依赖不加载 DOM 或事务实现。 */
import type {DragFillStep} from "./dragFill.types";
/** 用途：声明单步生成的完整输入。使用范围：纯操作生成。解耦评估：纯类型依赖不加载 DOM 或事务实现。 */
import type {DragFillStepRequest} from "./dragFill.types";

/** 判断目标值是否禁止通过拖拽覆盖。 */
const isReadonlyDragFillTarget = (request: DragFillStepRequest) => {
    const {target} = request;
    return target.type === "rollup" || target.type === "template" || target.type === "created" ||
        target.type === "updated" ||
        (target.type === "block" && target.element.getAttribute("data-detached") !== "true");
};

/** 为单个目标创建填充值和成对事务操作；只读目标返回 undefined。 @同步豁免: 遗留代码 - 拖拽事件必须在当前 mouseup 中依次完成 DOM 回写、焦点恢复和事务提交 */
export const createDragFillStep = (request: DragFillStepRequest) => {
    if (isReadonlyDragFillTarget(request)) {
        return;
    }
    const {target, source, avID, rowID} = request;
    if (!source) {
        throw new Error("AV drag fill writable target requires source data");
    }
    const data: IAVCellValue = JSON.parse(JSON.stringify(source));
    data.id = target.id;
    // 块列复制后必须成为独立值，避免继续引用来源块身份。
    if (data.type === "block") {
        data.isDetached = true;
    }
    // 来源块身份仅在 block 数据实际存在时删除。
    if (data.type === "block" && data.block) {
        Reflect.deleteProperty(data.block, "id");
    }
    return {
        data,
        doOperation: {
            action: "updateAttrViewCell",
            id: target.id,
            avID,
            keyID: target.colId,
            rowID,
            data,
        },
        undoOperation: {
            action: "updateAttrViewCell",
            id: target.id,
            avID,
            keyID: target.colId,
            rowID,
            data: target,
        },
    } satisfies DragFillStep;
};
