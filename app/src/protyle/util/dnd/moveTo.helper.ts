/**
 * moveTo 辅助函数统一导出
 * 
 * 为保持向后兼容，本文件重新导出所有分拆后的辅助函数
 */

// 列表相关操作
export {
    handleNewListCreation,
    updateListAfterOperation,
    finalizeListOrders
} from "./moveTo.helper.list";

// 复制相关操作
export {
    handleCopyOperation,
    processCopyFoldHeadingIds
} from "./moveTo.helper.copy";

// 移动相关操作
export {
    handleMoveOperation
} from "./moveTo.helper.move";

// 清理相关操作
export {
    cleanupSourceElement
} from "./moveTo.helper.cleanup";
