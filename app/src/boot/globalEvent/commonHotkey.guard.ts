/** 用途：isStylableElement DOM 元素类型守卫函数。使用范围：快捷键配置的类型守卫，用于 isHTMLElement 代理转发。解耦评估：通过目录 imports.ts 转发可降低路径耦合。 */
import { isStylableElement } from "../../util/DOM/element.guard";

/**
 * 类型守卫：判断 keymap 是否为通用快捷键配置
 *
 * 作用：将 Config.IKeys 类型收窄为 Config.IKeymapGeneral
 * 意图：TypeScript 无法自动推断 keymap 的具体类型，需要类型守卫辅助
 * 调用时机：在 setGeneralKeymap 中设置通用快捷键配置前调用
 * 问题/改进：当前实现始终返回 true，依赖调用方确保传入正确类型
 */
export const isKeymapGeneral = (keymap: Config.IKeys): keymap is Config.IKeymapGeneral => {
    return true;
};

/**
 * 类型守卫：判断 keymap 是否为编辑器快捷键配置的某个分区
 *
 * 作用：将 Config.IKeys 类型收窄为 Config.IKeymapEditor 的某个分区类型
 * 意图：TypeScript 无法自动推断 keymap 的具体类型，需要类型守卫辅助
 * 调用时机：在 setEditorKeymap 中设置编辑器快捷键配置前调用
 * 问题/改进：当前实现始终返回 true，依赖调用方确保传入正确类型
 */
export const isKeymapEditorSection = (keymap: Config.IKeys): keymap is Config.IKeymapEditor[keyof Config.IKeymapEditor] => {
    return true;
};

/**
 * 类型守卫：判断事件目标是否为可样式化元素（HTMLElement 或 SVGElement）
 * @deprecated 请直接从 '@/util/DOM/element.guard' 导入 isStylableElement
 */
export const isHTMLElement = isStylableElement as (target: EventTarget | null) => target is HTMLElement | SVGElement;
