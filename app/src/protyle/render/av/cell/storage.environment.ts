/**
 * 用途：全局常量
 * 使用范围：获取LOCAL_IMAGES配置
 * 解耦评估：通过imports.ts统一管理
 */
import { Constants } from "./imports";

/**
 * 作用：获取默认文件图标
 * 意图：封装window.siyuan.storage访问，避免直接访问全局对象
 * 调用时机：渲染block和relation类型单元格时需要默认图标
 * 问题/改进：依赖全局window对象，但已通过environment文件封装
 * @同步豁免: 需要绝对同步的DOM访问 - 读取全局配置
 */
export const getDefaultFileIcon = () => {
    const storage = window.siyuan?.storage;
    if (!storage) {
        return "";
    }
    const localImages = storage[Constants.LOCAL_IMAGES];
    if (!localImages) {
        return "";
    }
    return localImages.file || "";
};
