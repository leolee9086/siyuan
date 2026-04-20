/**
 * 用途：从 `editKeydown` 专用子目录引入同名实现，保持当前文件作为稳定入口文件存在。
 * 使用范围：仅供当前文件把原始实现重新暴露给 [`windowKeyDown.ts`](app/src/boot/globalEvent/keydown/windowKeyDown.ts:48) 等既有调用方。
 * 解耦评估：复杂实现已经下沉到子目录，本文件仅保留稳定导入边界；后续内部继续拆分时，无需改变外部引用路径。
 */
import { editKeydown } from "./editKeydown/index";

// 导出语句注释：导出 editKeydown 的稳定入口，保持外部导入路径不变。
export { editKeydown };
