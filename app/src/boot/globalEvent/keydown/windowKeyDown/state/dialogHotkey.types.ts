/** 用途：复用窗口键盘状态中的对话框命中类型和 general 键位结构。使用范围：仅限对话框快捷键纯函数的输入输出契约；这些类型没有运行时依赖，继续通过类型导入保持低耦合。 */
import type {DialogPressedHotkey} from "../types";
/** 用途：复用窗口键盘状态中的 general 键位结构。使用范围：仅供对话框快捷键输入契约使用；该类型依赖为编译期契约，不能由参数注入替代，保留类型导入可避免复制配置结构。 */
import type {WindowGeneralKeymap} from "../types";

/** 用途：抽象快捷键匹配器，供对话框快捷键纯函数注入实际的匹配实现。 */
export type HotkeyMatcher = (hotkey: string, event: KeyboardEvent) => boolean;

/** 用途：描述对话框快捷键判定所需的配置、事件和匹配器，供状态收集与单元测试复用。 */
export interface DialogHotkeyMatchInput {
    generalKeymap: WindowGeneralKeymap | undefined;
    event: KeyboardEvent;
    matchAuxiliaryHotKey: HotkeyMatcher;
    matchHotKey: HotkeyMatcher;
}

/** 用途：约束对话框快捷键纯函数的返回值，关联窗口对话框路由的辨识联合。 */
export type DialogHotkeyMatchResult = DialogPressedHotkey;
