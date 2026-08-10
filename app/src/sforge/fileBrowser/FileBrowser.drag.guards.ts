/**
 * 用途：拖放载荷项守卫。
 * 使用范围：文件树、画廊和标签投递的 JSON 边界。
 * 解耦评估：该守卫只依赖共享对象判定，注入会增加每个拖放入口的重复代码，因此保持领域基础守卫复用。
 */
import {isRecord} from "./FileBrowser.guards";
/**
 * 用途：拖放载荷类型。
 * 使用范围：树节点和画廊多选拖放。
 * 解耦评估：该类型是载荷边界的唯一数据契约，调用方不应自行声明同形接口。
 */
import type {FileBrowserDragItem} from "./FileBrowser.types";

/** 校验一个拖放项的根内地址和节点类型，拒绝绝对路径或不完整载荷。 */
export const isFileBrowserDragItem = (value: unknown): value is FileBrowserDragItem =>
    isRecord(value) && typeof value.rootID === "string" && typeof value.path === "string" &&
    (value.kind === "file" || value.kind === "directory") && typeof value.name === "string";
