/** 用途：提交已完成本地菜单状态决策的 Gallery 设置事务；使用范围：本文件严格命令；解耦评估：经 View Prepared 网关直达提交内核。 */
import {submitPreparedTransaction} from "./imports";

/** 判断 action 是否属于 Gallery 布局设置的完整封闭集合；旧尺寸与宽高比协议保留用于历史事务回放。 */
const isAVGallerySettingAction = (action: IOperation["action"]) =>
    action === "setAttrViewCoverFrom" ||
    action === "setAttrViewCoverFromAssetKeyID" ||
    action === "setAttrViewCardSize" ||
    action === "setAttrViewCardAspectRatio" ||
    action === "setAttrViewCardWidth" ||
    action === "setAttrViewCardAspectRatioValue";

/** 校验 Gallery 设置命令没有混入其它领域 action。 */
const assertAVGallerySettingOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find(operation => !isAVGallerySettingAction(operation.action));
    if (invalidOperation) {
        throw new Error(`AV gallery setting transaction does not accept action ${invalidOperation.action}`);
    }
};

/**
 * 提交 Gallery 设置菜单已经完成当前实例状态更新的事务。
 * @同步豁免: 生命周期
 */
export const submitAVGallerySettingTransaction = (
    protyle: IProtyle,
    doOperations: IOperation[],
    undoOperations: IOperation[],
) => {
    assertAVGallerySettingOperations(doOperations);
    assertAVGallerySettingOperations(undoOperations);
    submitPreparedTransaction({protyle, doOperations, undoOperations});
};
