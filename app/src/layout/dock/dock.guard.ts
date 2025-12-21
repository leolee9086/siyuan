/**
 * 收藏夹模块类型守卫
 */

const checkString = (val: unknown) => val === undefined || typeof val === "string";
const checkBoolean = (val: unknown) => val === undefined || typeof val === "boolean";
const checkArrayString = (val: unknown) => val === undefined || (Array.isArray(val) && val.every(i => typeof i === "string"));

const isOperation = (item: unknown): item is IOperation => {
    if (typeof item !== "object" || item === null) {
        return false;
    }
    const op = item as Record<string, unknown>;
    // 核心属性校验
    if (typeof op.action !== "string") {
        return false;
    }
    // 详细属性校验（基于 IOperation 接口定义）
    return checkString(op.id) &&
        checkString(op.blockID) &&
        checkBoolean(op.isTwoWay) &&
        checkString(op.backRelationKeyID) &&
        checkString(op.avID) &&
        checkString(op.format) &&
        checkString(op.keyID) &&
        checkString(op.rowID) &&
        checkString(op.parentID) &&
        checkString(op.previousID) &&
        checkString(op.nextID) &&
        checkBoolean(op.isDetached) &&
        checkArrayString(op.srcIDs) &&
        checkBoolean(op.ignoreDefaultFill) &&
        checkString(op.viewID) &&
        checkString(op.name) &&
        checkString(op.type) &&
        checkString(op.deckID) &&
        checkArrayString(op.blockIDs) &&
        checkBoolean(op.removeDest) &&
        checkString(op.layout) &&
        checkString(op.groupID) &&
        checkString(op.targetGroupID);
};

/**
 * 判断是否为操作接口数组
 */
export function isOperations(data: unknown): data is IOperation[] {
    if (!Array.isArray(data)) {
        return false;
    }
    return data.every(isOperation);
}
