/**
 * 现实世界用例测试：富文本编辑器键盘事件分发
 * 
 * 模拟一个类似思源笔记的块编辑器，测试复杂的事件分发场景：
 * - 多种块类型（段落、标题、代码块、列表、引用、表格）
 * - 修饰键组合（Ctrl/Shift/Alt）
 * - 选区状态（无选区、单选、跨块选区）
 * - 面板状态（搜索面板、菜单面板、提示面板）
 * - 编辑模式（编辑/只读/演示）
 */

import { describe, it, expect } from "vitest";
import { type } from "arktype";
import { calibur } from "../../src/index.js";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 编辑器状态全集
 */
const 编辑器状态Schema = type({
    // 按键信息
    按键: "string",
    修饰符: {
        ctrl: "boolean",
        shift: "boolean",
        alt: "boolean",
        meta: "boolean"
    },

    // 块信息
    块: {
        类型: "'段落' | '标题' | '代码块' | '列表' | '引用' | '表格'",
        级别: "number",  // 标题1-6，列表缩进级别
        语言: "string | null"  // 代码块语言
    },

    // 选区状态
    选区: {
        类型: "'无' | '光标' | '范围' | '跨块'",
        在行首: "boolean",
        在行尾: "boolean"
    },

    // 面板状态
    面板: {
        搜索: "boolean",
        菜单: "boolean",
        提示: "boolean",
        斜杠命令: "boolean"
    },
    // 派生状态：当前活跃的面板（用于路由）
    活跃面板: "'搜索' | '菜单' | '提示' | '斜杠命令' | '无'",

    // 编辑模式
    模式: "'编辑' | '只读' | '演示'"
});

type 编辑器状态 = typeof 编辑器状态Schema.infer;

// ============================================================================
// 命令定义
// ============================================================================

interface 命令结果 {
    命令: string;
    参数?: Record<string, unknown>;
}

// ============================================================================
// 子分发器：代码块专用处理
// ============================================================================

const 代码块处理器 = calibur.universe(type({
    按键: "string",
    修饰符: {
        ctrl: "boolean",  // 注意：虽然这里允许boolean，但在使用时会被约束为false
        shift: "boolean",
        alt: "boolean",
        meta: "boolean"
    },
    块: {
        类型: "'代码块'",
        级别: "number",
        语言: "string | null"
    }
}))
    // Tab 键处理
    .split(
        type({ 按键: "'Tab'", 修饰符: { shift: "false" } }),
        () => ({ 命令: "代码缩进" })
    )
    .split(
        type({ 按键: "'Tab'", 修饰符: { shift: "true" } }),
        () => ({ 命令: "代码反缩进" })
    )
    // Enter 键处理 (Ctrl+Enter 已移至全局处理器)
    .split(
        type({ 按键: "'Enter'" }),
        () => ({ 命令: "代码换行" })
    )
    // Escape 退出代码块
    .split(
        type({ 按键: "'Escape'" }),
        () => ({ 命令: "退出代码块" })
    )
    .remain((state) => ({ 命令: "代码输入", 参数: { 按键: state.按键 } }))
    .build();

// ============================================================================
// 子分发器：列表专用处理
// ============================================================================

const 列表处理器 = calibur.universe(type({
    按键: "string",
    修饰符: {
        ctrl: "boolean",
        shift: "boolean",
        alt: "boolean",
        meta: "boolean"
    },
    块: {
        类型: "'列表'",
        级别: "number",
        语言: "string | null"
    },
    选区: {
        类型: "'无' | '光标' | '范围' | '跨块'",
        在行首: "boolean",
        在行尾: "boolean"
    }
}))
    // Tab 缩进
    .split(
        type({ 按键: "'Tab'", 修饰符: { shift: "false" } }),
        (state) => ({ 命令: "列表缩进", 参数: { 当前级别: state.块.级别 } })
    )
    .split(
        type({ 按键: "'Tab'", 修饰符: { shift: "true" } }),
        (state) => ({ 命令: "列表反缩进", 参数: { 当前级别: state.块.级别 } })
    )
    // Enter 键：行首时减少缩进或退出列表
    .split(
        type({ 按键: "'Enter'", 选区: { 在行首: "true" } }),
        (state) => state.块.级别 > 0
            ? { 命令: "减少列表级别" }
            : { 命令: "退出列表" }
    )
    // Enter 键：正常新建列表项
    .split(
        type({ 按键: "'Enter'", 选区: { 在行首: "false" } }),
        () => ({ 命令: "新建列表项" })
    )
    // Backspace 行首删除
    .split(
        type({ 按键: "'Backspace'", 选区: { 在行首: "true" } }),
        () => ({ 命令: "合并到上一列表项" })
    )
    .remain((state) => ({ 命令: "列表输入", 参数: { 按键: state.按键 } }))
    .build();

// ============================================================================
// 子分发器：表格专用处理
// ============================================================================

const 表格处理器 = calibur.universe(type({
    按键: "string",
    修饰符: {
        ctrl: "boolean",
        shift: "boolean",
        alt: "boolean",
        meta: "boolean"
    },
    块: {
        类型: "'表格'",
        级别: "number",
        语言: "string | null"
    }
}))
    // Tab 移动到下一个单元格
    .split(
        type({ 按键: "'Tab'", 修饰符: { shift: "false" } }),
        () => ({ 命令: "表格下一单元格" })
    )
    .split(
        type({ 按键: "'Tab'", 修饰符: { shift: "true" } }),
        () => ({ 命令: "表格上一单元格" })
    )
    // Enter 移动到下一行
    .split(
        type({ 按键: "'Enter'" }),
        () => ({ 命令: "表格下一行" })
    )
    // 方向键导航
    .split(
        type({ 按键: "'ArrowUp'" }),
        () => ({ 命令: "表格上移" })
    )
    .split(
        type({ 按键: "'ArrowDown'" }),
        () => ({ 命令: "表格下移" })
    )
    .split(
        type({ 按键: "'ArrowLeft'" }),
        () => ({ 命令: "表格左移" })
    )
    .split(
        type({ 按键: "'ArrowRight'" }),
        () => ({ 命令: "表格右移" })
    )
    .remain((state) => ({ 命令: "表格输入", 参数: { 按键: state.按键 } }))
    .build();

// ============================================================================
// 面板处理器
// ============================================================================

const 面板处理器 = calibur.universe(type({
    按键: "string",
    活跃面板: "'搜索' | '菜单' | '提示' | '斜杠命令' | '无'"
}))
    // 搜索面板
    .split(
        type({ 活跃面板: "'搜索'", 按键: "'Escape'" }),
        () => ({ 命令: "关闭搜索" })
    )
    .split(
        type({ 活跃面板: "'搜索'", 按键: "'Enter'" }),
        () => ({ 命令: "执行搜索" })
    )
    .split(
        type({ 活跃面板: "'搜索'", 按键: "'F3'" }),
        () => ({ 命令: "下一个搜索结果" })
    )
    // 菜单面板
    .split(
        type({ 活跃面板: "'菜单'", 按键: "'Escape'" }),
        () => ({ 命令: "关闭菜单" })
    )
    .split(
        type({ 活跃面板: "'菜单'", 按键: "'ArrowUp'" }),
        () => ({ 命令: "菜单上移" })
    )
    .split(
        type({ 活跃面板: "'菜单'", 按键: "'ArrowDown'" }),
        () => ({ 命令: "菜单下移" })
    )
    .split(
        type({ 活跃面板: "'菜单'", 按键: "'Enter'" }),
        () => ({ 命令: "执行菜单项" })
    )
    // 提示面板
    .split(
        type({ 活跃面板: "'提示'", 按键: "'Escape'" }),
        () => ({ 命令: "关闭提示" })
    )
    .split(
        type({ 活跃面板: "'提示'", 按键: "'Tab'" }),
        () => ({ 命令: "接受提示" })
    )
    // 斜杠命令
    .split(
        type({ 活跃面板: "'斜杠命令'", 按键: "'Escape'" }),
        () => ({ 命令: "关闭斜杠命令" })
    )
    .split(
        type({ 活跃面板: "'斜杠命令'", 按键: "'Enter'" }),
        () => ({ 命令: "执行斜杠命令" })
    )
    .split(
        type({ 活跃面板: "'斜杠命令'", 按键: "'ArrowUp'" }),
        () => ({ 命令: "斜杠命令上移" })
    )
    .split(
        type({ 活跃面板: "'斜杠命令'", 按键: "'ArrowDown'" }),
        () => ({ 命令: "斜杠命令下移" })
    )
    .otherwise(() => null)
    .build();

const 全局快捷键处理器 = calibur.universe(type({
    按键: "string",
    修饰符: {
        ctrl: "boolean",
        shift: "boolean",
        alt: "boolean",
        meta: "boolean"
    },
    块: {
        类型: "string", // 需要感知块类型以处理特定 Ctrl 组合
        级别: "number",
        语言: "string | null"
    }
}))
    // Ctrl+S 保存
    .split(
        type({ 按键: "'s'", 修饰符: { ctrl: "true" } }),
        () => ({ 命令: "保存" })
    )
    // Ctrl+Z 撤销
    .split(
        type({ 按键: "'z'", 修饰符: { ctrl: "true", shift: "false" } }),
        () => ({ 命令: "撤销" })
    )
    // Ctrl+Shift+Z 或 Ctrl+Y 重做
    .split(
        type({ 按键: "'z'", 修饰符: { ctrl: "true", shift: "true" } }),
        () => ({ 命令: "重做" })
    )
    .split(
        type({ 按键: "'y'", 修饰符: { ctrl: "true" } }),
        () => ({ 命令: "重做" })
    )
    // Ctrl+C/V/X 剪贴板
    .split(
        type({ 按键: "'c'", 修饰符: { ctrl: "true" } }),
        () => ({ 命令: "复制" })
    )
    .split(
        type({ 按键: "'v'", 修饰符: { ctrl: "true" } }),
        () => ({ 命令: "粘贴" })
    )
    .split(
        type({ 按键: "'x'", 修饰符: { ctrl: "true" } }),
        () => ({ 命令: "剪切" })
    )
    // Ctrl+A 全选
    .split(
        type({ 按键: "'a'", 修饰符: { ctrl: "true" } }),
        () => ({ 命令: "全选" })
    )
    // Ctrl+F 搜索
    .split(
        type({ 按键: "'f'", 修饰符: { ctrl: "true" } }),
        () => ({ 命令: "打开搜索" })
    )
    // Ctrl+B/I/U 格式
    .split(
        type({ 按键: "'b'", 修饰符: { ctrl: "true" } }),
        () => ({ 命令: "切换粗体" })
    )
    .split(
        type({ 按键: "'i'", 修饰符: { ctrl: "true" } }),
        () => ({ 命令: "切换斜体" })
    )
    .split(
        type({ 按键: "'u'", 修饰符: { ctrl: "true" } }),
        () => ({ 命令: "切换下划线" })
    )
    // Ctrl+Enter 运行代码块 (此前在代码块处理器中)
    .split(
        type({
            按键: "'Enter'",
            修饰符: { ctrl: "true" },
            块: { 类型: "'代码块'" }
        }),
        () => ({ 命令: "运行代码块" })
    )

    .otherwise(() => null)
    .build();

// ============================================================================
// 编辑分发器（子分发器）
// ============================================================================

/**
 * 处理编辑模式下的所有交互
 * 前置条件：模式="编辑" 且 活跃面板="无"
 */
const 编辑分发器 = calibur.universe(编辑器状态Schema)
    // 1. 修饰键优先：所有 Ctrl 组合交给全局处理器
    .split(
        type({ 修饰符: { ctrl: "true" } }),
        (state) => {
            // 注意：需要传递块信息以便处理上下文相关的 Ctrl 组合
            const result = 全局快捷键处理器({
                按键: state.按键,
                修饰符: state.修饰符,
                块: state.块
            });
            // 如果全局处理器没处理（例如未定义的 Ctrl 快捷键），返回未知快捷键
            return result ?? { 命令: "未知快捷键", 参数: { 按键: state.按键 } };
        }
    )
    // 2. 块处理（隐含 constraints: ctrl=false）
    // 代码块专用处理
    .split(
        type({
            块: { 类型: "'代码块'" },
            修饰符: { ctrl: "false" }
        }),
        (state) => 代码块处理器({
            按键: state.按键,
            修饰符: state.修饰符,
            块: state.块 as { 类型: "代码块"; 级别: number; 语言: string | null }
        })
    )
    // 列表专用处理
    .split(
        type({
            块: { 类型: "'列表'" },
            修饰符: { ctrl: "false" }
        }),
        (state) => 列表处理器({
            按键: state.按键,
            修饰符: state.修饰符,
            块: state.块 as { 类型: "列表"; 级别: number; 语言: string | null },
            选区: state.选区
        })
    )
    // 表格专用处理
    .split(
        type({
            块: { 类型: "'表格'" },
            修饰符: { ctrl: "false" }
        }),
        (state) => 表格处理器({
            按键: state.按键,
            修饰符: state.修饰符,
            块: state.块 as { 类型: "表格"; 级别: number; 语言: string | null }
        })
    )
    // 通用文本块处理（段落/标题/引用，且 ctrl=false）
    .remain((state) => {
        // 安全检查：如果 Ctrl=true 进入了这里，说明上述 split 有漏洞
        if (state.修饰符.ctrl) {
            return { 命令: "未知快捷键", 参数: { 按键: state.按键 } };
        }

        // Enter 键
        if (state.按键 === "Enter") {
            if (state.修饰符.shift) {
                return { 命令: "软换行" };
            }
            return { 命令: "新建段落" };
        }
        // Backspace
        if (state.按键 === "Backspace") {
            if (state.选区.在行首 && state.选区.类型 === "光标") {
                return { 命令: "合并到上一块" };
            }
            return { 命令: "删除" };
        }
        // Delete
        if (state.按键 === "Delete") {
            if (state.选区.在行尾 && state.选区.类型 === "光标") {
                return { 命令: "合并下一块" };
            }
            return { 命令: "删除" };
        }
        // Tab
        if (state.按键 === "Tab") {
            return { 命令: "插入制表符" };
        }
        // 方向键
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(state.按键)) {
            return { 命令: "导航", 参数: { 方向: state.按键, shift: state.修饰符.shift } };
        }
        // 默认文本输入
        return { 命令: "文本输入", 参数: { 按键: state.按键, 块类型: state.块.类型 } };
    })
    .build();

// ============================================================================
// 主分发器
// ============================================================================

/**
 * 构建主编辑器事件分发器
 * 
 * 处理优先级：
 * 1. 面板处理 - 活跃面板不为"无"时优先处理
 * 2. 非编辑模式处理 - 只读/演示模式且无面板时
 * 3. 编辑模式处理 - 编辑模式且无面板时
 */
const 编辑器分发器 = calibur.universe(编辑器状态Schema)
    // 1. 面板处理（优先级最高）
    .split(
        type({ 活跃面板: "'搜索' | '菜单' | '提示' | '斜杠命令'" }),
        (state) => {
            const result = 面板处理器({ 按键: state.按键, 活跃面板: state.活跃面板 });
            return result ?? { 命令: "面板输入", 参数: { 按键: state.按键 } };
        }
    )
    // 2. 非编辑模式：只允许基本导航
    .split(
        type({
            模式: "'只读' | '演示'",
            活跃面板: "'无'"
        }),
        (state) => {
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"].includes(state.按键)) {
                return { 命令: "导航", 参数: { 方向: state.按键 } };
            }
            if (state.按键 === "Escape") {
                return { 命令: "退出模式" };
            }
            return { 命令: "忽略", 参数: { 原因: "非编辑模式" } };
        }
    )
    // 3. 编辑模式：委托给编辑分发器
    .split(
        type({
            模式: "'编辑'",
            活跃面板: "'无'"
        }),
        (state) => 编辑分发器(state)
    )
    // 三个层次已覆盖全部面板与模式组合，直接构建耗尽路由。
    .build();

// ============================================================================
// 测试用例
// ============================================================================

describe("现实世界用例：富文本编辑器键盘分发", () => {
    // 基础状态工厂
    const 创建基础状态 = (覆盖: Partial<编辑器状态> = {}): 编辑器状态 => {
        const 面板 = 覆盖.面板 || { 搜索: false, 菜单: false, 提示: false, 斜杠命令: false };
        let 活跃面板: 编辑器状态["活跃面板"] = "无";
        if (面板.搜索) 活跃面板 = "搜索";
        else if (面板.菜单) 活跃面板 = "菜单";
        else if (面板.提示) 活跃面板 = "提示";
        else if (面板.斜杠命令) 活跃面板 = "斜杠命令";

        return {
            按键: "a",
            修饰符: { ctrl: false, shift: false, alt: false, meta: false },
            块: { 类型: "段落", 级别: 0, 语言: null },
            选区: { 类型: "光标", 在行首: false, 在行尾: false },
            面板: { 搜索: false, 菜单: false, 提示: false, 斜杠命令: false },
            模式: "编辑",
            活跃面板,
            ...覆盖,
        };
    };

    describe("模式处理", () => {
        it("只读模式应该只允许导航", () => {
            const state = 创建基础状态({ 模式: "只读", 按键: "ArrowDown" });
            expect(编辑器分发器(state)).toEqual({ 命令: "导航", 参数: { 方向: "ArrowDown" } });
        });

        it("只读模式应该忽略编辑按键", () => {
            const state = 创建基础状态({ 模式: "只读", 按键: "a" });
            expect(编辑器分发器(state)).toEqual({ 命令: "忽略", 参数: { 原因: "非编辑模式" } });
        });

        it("演示模式Escape应该退出", () => {
            const state = 创建基础状态({ 模式: "演示", 按键: "Escape" });
            expect(编辑器分发器(state)).toEqual({ 命令: "退出模式" });
        });
    });

    describe("面板处理", () => {
        it("搜索面板Enter应该执行搜索", () => {
            const state = 创建基础状态({
                按键: "Enter",
                面板: { 搜索: true, 菜单: false, 提示: false, 斜杠命令: false }
            });
            expect(编辑器分发器(state)).toEqual({ 命令: "执行搜索" });
        });

        it("菜单面板方向键应该导航", () => {
            const state = 创建基础状态({
                按键: "ArrowUp",
                面板: { 搜索: false, 菜单: true, 提示: false, 斜杠命令: false }
            });
            expect(编辑器分发器(state)).toEqual({ 命令: "菜单上移" });
        });

        it("提示面板Tab应该接受提示", () => {
            const state = 创建基础状态({
                按键: "Tab",
                面板: { 搜索: false, 菜单: false, 提示: true, 斜杠命令: false }
            });
            expect(编辑器分发器(state)).toEqual({ 命令: "接受提示" });
        });

        it("斜杠命令面板Enter应该执行", () => {
            const state = 创建基础状态({
                按键: "Enter",
                面板: { 搜索: false, 菜单: false, 提示: false, 斜杠命令: true }
            });
            expect(编辑器分发器(state)).toEqual({ 命令: "执行斜杠命令" });
        });
    });

    describe("全局快捷键", () => {
        it("Ctrl+S应该保存", () => {
            const state = 创建基础状态({
                按键: "s",
                修饰符: { ctrl: true, shift: false, alt: false, meta: false }
            });
            expect(编辑器分发器(state)).toEqual({ 命令: "保存" });
        });

        it("Ctrl+Z应该撤销", () => {
            const state = 创建基础状态({
                按键: "z",
                修饰符: { ctrl: true, shift: false, alt: false, meta: false }
            });
            expect(编辑器分发器(state)).toEqual({ 命令: "撤销" });
        });

        it("Ctrl+Shift+Z应该重做", () => {
            const state = 创建基础状态({
                按键: "z",
                修饰符: { ctrl: true, shift: true, alt: false, meta: false }
            });
            expect(编辑器分发器(state)).toEqual({ 命令: "重做" });
        });

        it("Ctrl+B应该切换粗体", () => {
            const state = 创建基础状态({
                按键: "b",
                修饰符: { ctrl: true, shift: false, alt: false, meta: false }
            });
            expect(编辑器分发器(state)).toEqual({ 命令: "切换粗体" });
        });
    });

    describe("代码块处理", () => {
        const 代码块基础 = () => 创建基础状态({
            块: { 类型: "代码块", 级别: 0, 语言: "typescript" }
        });

        it("Tab应该缩进", () => {
            const state = { ...代码块基础(), 按键: "Tab" };
            expect(编辑器分发器(state)).toEqual({ 命令: "代码缩进" });
        });

        it("Shift+Tab应该反缩进", () => {
            const state = {
                ...代码块基础(),
                按键: "Tab",
                修饰符: { ctrl: false, shift: true, alt: false, meta: false }
            };
            expect(编辑器分发器(state)).toEqual({ 命令: "代码反缩进" });
        });

        it("Ctrl+Enter应该运行代码", () => {
            const state = {
                ...代码块基础(),
                按键: "Enter",
                修饰符: { ctrl: true, shift: false, alt: false, meta: false }
            };
            expect(编辑器分发器(state)).toEqual({ 命令: "运行代码块" });
        });

        it("Escape应该退出代码块", () => {
            const state = { ...代码块基础(), 按键: "Escape" };
            expect(编辑器分发器(state)).toEqual({ 命令: "退出代码块" });
        });
    });

    describe("列表处理", () => {
        const 列表基础 = (级别 = 1) => 创建基础状态({
            块: { 类型: "列表", 级别, 语言: null }
        });

        it("Tab应该缩进列表", () => {
            const state = { ...列表基础(1), 按键: "Tab" };
            expect(编辑器分发器(state)).toEqual({ 命令: "列表缩进", 参数: { 当前级别: 1 } });
        });

        it("行首Enter在有缩进时应该减少级别", () => {
            const state = {
                ...列表基础(2),
                按键: "Enter",
                选区: { 类型: "光标" as const, 在行首: true, 在行尾: false }
            };
            expect(编辑器分发器(state)).toEqual({ 命令: "减少列表级别" });
        });

        it("行首Enter在无缩进时应该退出列表", () => {
            const state = {
                ...列表基础(0),
                按键: "Enter",
                选区: { 类型: "光标" as const, 在行首: true, 在行尾: false }
            };
            expect(编辑器分发器(state)).toEqual({ 命令: "退出列表" });
        });

        it("普通Enter应该新建列表项", () => {
            const state = { ...列表基础(1), 按键: "Enter" };
            expect(编辑器分发器(state)).toEqual({ 命令: "新建列表项" });
        });
    });

    describe("表格处理", () => {
        const 表格基础 = () => 创建基础状态({
            块: { 类型: "表格", 级别: 0, 语言: null }
        });

        it("Tab应该移动到下一单元格", () => {
            const state = { ...表格基础(), 按键: "Tab" };
            expect(编辑器分发器(state)).toEqual({ 命令: "表格下一单元格" });
        });

        it("Enter应该移动到下一行", () => {
            const state = { ...表格基础(), 按键: "Enter" };
            expect(编辑器分发器(state)).toEqual({ 命令: "表格下一行" });
        });

        it("方向键应该在表格中导航", () => {
            const state = { ...表格基础(), 按键: "ArrowRight" };
            expect(编辑器分发器(state)).toEqual({ 命令: "表格右移" });
        });
    });

    describe("通用文本块处理", () => {
        it("Shift+Enter应该软换行", () => {
            const state = 创建基础状态({
                按键: "Enter",
                修饰符: { ctrl: false, shift: true, alt: false, meta: false }
            });
            expect(编辑器分发器(state)).toEqual({ 命令: "软换行" });
        });

        it("Enter应该新建段落", () => {
            const state = 创建基础状态({ 按键: "Enter" });
            expect(编辑器分发器(state)).toEqual({ 命令: "新建段落" });
        });

        it("行首Backspace应该合并块", () => {
            const state = 创建基础状态({
                按键: "Backspace",
                选区: { 类型: "光标", 在行首: true, 在行尾: false }
            });
            expect(编辑器分发器(state)).toEqual({ 命令: "合并到上一块" });
        });

        it("普通字符应该触发文本输入", () => {
            const state = 创建基础状态({ 按键: "x" });
            expect(编辑器分发器(state)).toEqual({
                命令: "文本输入",
                参数: { 按键: "x", 块类型: "段落" }
            });
        });
    });

    describe("复杂场景组合", () => {
        it("代码块中Ctrl+S应该先触发全局快捷键而非代码输入", () => {
            const state = 创建基础状态({
                块: { 类型: "代码块", 级别: 0, 语言: "javascript" },
                按键: "s",
                修饰符: { ctrl: true, shift: false, alt: false, meta: false }
            });
            // 全局快捷键优先于块类型处理
            expect(编辑器分发器(state)).toEqual({ 命令: "保存" });
        });

        it("斜杠命令面板打开时输入应该在面板中处理", () => {
            const state = 创建基础状态({
                块: { 类型: "段落", 级别: 0, 语言: null },
                按键: "ArrowDown",
                面板: { 搜索: false, 菜单: false, 提示: false, 斜杠命令: true }
            });
            expect(编辑器分发器(state)).toEqual({ 命令: "斜杠命令下移" });
        });

        it("只读模式下Ctrl+C仍然应该被忽略（只允许导航）", () => {
            const state = 创建基础状态({
                模式: "只读",
                按键: "c",
                修饰符: { ctrl: true, shift: false, alt: false, meta: false }
            });
            // 只读模式处理优先
            expect(编辑器分发器(state)).toEqual({ 命令: "忽略", 参数: { 原因: "非编辑模式" } });
        });

        it("标题块Enter应该和段落一样处理", () => {
            const state = 创建基础状态({
                块: { 类型: "标题", 级别: 2, 语言: null },
                按键: "Enter"
            });
            expect(编辑器分发器(state)).toEqual({ 命令: "新建段落" });
        });

        it("引用块中Tab应该插入制表符", () => {
            const state = 创建基础状态({
                块: { 类型: "引用", 级别: 0, 语言: null },
                按键: "Tab"
            });
            expect(编辑器分发器(state)).toEqual({ 命令: "插入制表符" });
        });
    });
});
