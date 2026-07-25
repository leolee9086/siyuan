/**
 * CalibURRouter 运行时测试
 * 
 * 测试运行时分发逻辑的正确性
 */

import { describe, it, expect } from "vitest";
import { type } from "arktype";
import { calibur, 匹配, 是子集, 有交集 } from "../src/index.js";

describe("calibur.universe 基础功能", () => {
    it("应该创建匹配器构建器", () => {
        const matcher = calibur.universe(type({
            按键: "string"
        }));

        expect(matcher).toBeDefined();
        expect(typeof matcher.split).toBe("function");
        expect(typeof matcher.remain).toBe("function");
    });

    it("单个split + remain应该正确分发", () => {
        const dispatch = calibur.universe(type({
            按键: "string"
        }))
            .split(type({ 按键: "'Enter'" }), () => ({ 命令: "回车" }))
            .remain((state) => ({ 命令: "默认" }))
            .build();

        expect(dispatch({ 按键: "Enter" })).toEqual({ 命令: "回车" });
        expect(dispatch({ 按键: "Tab" })).toEqual({ 命令: "默认" });
        expect(dispatch({ 按键: "a" })).toEqual({ 命令: "默认" });
    });

    it("多个split应该正确匹配非重叠模式", () => {
        // 注意：由于重叠检测，不能先定义 { 按键: 'Enter', ctrl: true }，再定义 { 按键: 'Enter' }
        // 正确的做法是在处理器内部处理子情况
        const dispatch = calibur.universe(type({
            按键: "string",
            修饰符: { ctrl: "boolean" }
        }))
            .split(
                type({ 按键: "'Enter'" }),
                (state) => ({ 命令: state.修饰符.ctrl ? "Ctrl+回车" : "回车" })
            )
            .split(
                type({ 按键: "'Tab'" }),
                () => ({ 命令: "制表符" })
            )
            .remain(() => ({ 命令: "默认" }))
            .build();

        // Ctrl+Enter 应该匹配并返回 "Ctrl+回车"
        expect(dispatch({ 按键: "Enter", 修饰符: { ctrl: true } }))
            .toEqual({ 命令: "Ctrl+回车" });

        // 普通Enter应该匹配并返回 "回车"
        expect(dispatch({ 按键: "Enter", 修饰符: { ctrl: false } }))
            .toEqual({ 命令: "回车" });

        // Tab应该匹配第二个
        expect(dispatch({ 按键: "Tab", 修饰符: { ctrl: false } }))
            .toEqual({ 命令: "制表符" });

        // 其他应该匹配remain
        expect(dispatch({ 按键: "a", 修饰符: { ctrl: false } }))
            .toEqual({ 命令: "默认" });
    });
});

describe("键盘事件分发场景", () => {
    it("应该处理复杂的键盘事件状态空间", () => {
        const 键盘事件 = type({
            按键: "string",
            修饰符: {
                ctrl: "boolean",
                shift: "boolean",
                alt: "boolean"
            },
            块类型: "'段落' | '代码块' | '列表'"
        });

        // 注意：由于重叠检测，不能先定义 { 按键: 'Tab', 块类型: '列表' }
        // 然后再定义 { 按键: 'Tab', 修饰符: { shift: true }, 块类型: '列表' }
        // 正确的做法是在处理器内部根据修饰符判断
        const dispatch = calibur.universe(键盘事件)
            // Tab在列表中，根据shift判断缩进/减缩进
            .split(
                type({ 按键: "'Tab'", 块类型: "'列表'" }),
                (state) => ({ 命令: state.修饰符.shift ? "列表减缩进" : "列表缩进" })
            )
            // Enter键（在处理器内部判断块类型）
            .split(
                type({ 按键: "'Enter'" }),
                (state) => state.块类型 === "代码块"
                    ? { 命令: "代码块换行" }
                    : { 命令: "分段" }
            )
            .remain(() => ({ 命令: "无操作" }))
            .build();

        // 列表中Tab = 缩进
        expect(dispatch({
            按键: "Tab",
            修饰符: { ctrl: false, shift: false, alt: false },
            块类型: "列表"
        })).toEqual({ 命令: "列表缩进" });

        // 列表中Shift+Tab = 减缩进
        expect(dispatch({
            按键: "Tab",
            修饰符: { ctrl: false, shift: true, alt: false },
            块类型: "列表"
        })).toEqual({ 命令: "列表减缩进" });

        // 代码块中Enter = 换行
        expect(dispatch({
            按键: "Enter",
            修饰符: { ctrl: false, shift: false, alt: false },
            块类型: "代码块"
        })).toEqual({ 命令: "代码块换行" });

        // 段落中Enter = 分段
        expect(dispatch({
            按键: "Enter",
            修饰符: { ctrl: false, shift: false, alt: false },
            块类型: "段落"
        })).toEqual({ 命令: "分段" });

        // 其他 = 无操作
        expect(dispatch({
            按键: "a",
            修饰符: { ctrl: false, shift: false, alt: false },
            块类型: "段落"
        })).toEqual({ 命令: "无操作" });
    });
});

describe("集合运算工具函数", () => {
    it("匹配应该正确验证输入", () => {
        const 模式 = type({ 名称: "string", 年龄: "number" });

        expect(匹配(模式, { 名称: "张三", 年龄: 25 }))
            .toEqual({ 名称: "张三", 年龄: 25 });

        expect(匹配(模式, { 名称: "张三" })).toBeNull();
        expect(匹配(模式, { 名称: 123, 年龄: 25 })).toBeNull();
        expect(匹配(模式, "invalid")).toBeNull();
    });

    it("是子集应该正确判断子集关系", () => {
        const 字符串A = type("'a'");
        const 字符串AB = type("'a' | 'b'");
        const 字符串 = type("string");

        expect(是子集(字符串A, 字符串AB)).toBe(true);  // 'a' ⊆ 'a'|'b'
        expect(是子集(字符串A, 字符串)).toBe(true);    // 'a' ⊆ string
        expect(是子集(字符串AB, 字符串A)).toBe(false); // 'a'|'b' ⊄ 'a'
        expect(是子集(字符串, 字符串A)).toBe(false);   // string ⊄ 'a'
    });

    it("有交集应该正确判断交集", () => {
        const AB = type("'a' | 'b'");
        const BC = type("'b' | 'c'");
        const CD = type("'c' | 'd'");

        expect(有交集(AB, BC)).toBe(true);  // 交集为 'b'
        expect(有交集(AB, CD)).toBe(false); // 无交集
    });
});

describe("处理器返回值", () => {
    it("处理器应该可以返回任意类型", () => {
        const dispatch = calibur.universe(type({ 类型: "'A' | 'B'" }))
            .split(type({ 类型: "'A'" }), () => 42)
            .split(type({ 类型: "'B'" }), () => "hello")
            .build();

        expect(dispatch({ 类型: "A" })).toBe(42);
        expect(dispatch({ 类型: "B" })).toBe("hello");
    });

    it("处理器应该接收匹配的状态", () => {
        const 用户状态 = type({
            用户: { 名称: "string", 等级: "'VIP' | '普通'" }
        });

        const dispatch = calibur.universe(用户状态)
            .split(
                // 关键：模式只指定部分属性用于匹配筛选
                // 但处理器仍能访问全集的所有属性
                type({ 用户: { 等级: "'VIP'" } }),
                (state) => `高级用户: ${state.用户.名称}`  // 可以访问名称，因为处理器接收全集类型
            )
            .remain(
                // 此时 TS 能正确推断剩余集为 { 用户: { 等级: '普通', ... } }
                (state) => `普通用户: ${state.用户.名称}`
            )
            .build();

        expect(dispatch({ 用户: { 名称: "张三", 等级: "VIP" } }))
            .toBe("高级用户: 张三");

        expect(dispatch({ 用户: { 名称: "李四", 等级: "普通" } }))
            .toBe("普通用户: 李四");
    });
});

describe("运行时限制", () => {
    it("当模式完全覆盖全集时，应该禁止继续调用split", () => {
        const 全集 = type({ 类型: "'A'" }).or({ 类型: "'B'" });

        // 分两步覆盖全集
        const builder = calibur.universe(全集)
            .split(type({ 类型: "'A'" }), () => 1)
            .split(type({ 类型: "'B'" }), () => 2);

        // 此时 builder 应该已经是 ExhaustedMatcherBuilder
        // 尝试继续 split 应该抛出错误
        expect(() => {
            // @ts-expect-error
            builder.split(type({ 类型: "'A'" }), (state) => 3);
        }).toThrow("当前匹配器已耗尽");
    });

    it("当模式完全覆盖全集时，应该禁止调用remain", () => {
        const 全集 = type({ 类型: "'A'" }).or({ 类型: "'B'" });

        const builder = calibur.universe(全集)
            .split(type({ 类型: "'A'" }), () => 1)
            .split(type({ 类型: "'B'" }), () => 2);

        // 尝试调用 remain 应该抛出错误
        expect(() => {
            // @ts-expect-error
            builder.remain((state) => 3);
        }).toThrow("剩余集为空");
    });

    it("层次化部分模式覆盖全集后应该同时进入编译期和运行时耗尽态", () => {
        const 全集 = type({
            模式: "'编辑' | '只读' | '演示'",
            活跃面板: "'搜索' | '菜单' | '提示' | '斜杠命令' | '无'",
        });
        const builder = calibur.universe(全集)
            .split(type({活跃面板: "'搜索' | '菜单' | '提示' | '斜杠命令'"}), () => "面板")
            .split(type({模式: "'只读' | '演示'", 活跃面板: "'无'"}), () => "非编辑")
            .split(type({模式: "'编辑'", 活跃面板: "'无'"}), () => "编辑");

        expect(() => {
            // @ts-expect-error 完整覆盖后只允许 build。
            builder.remain(() => "不可达");
        }).toThrow("剩余集为空");
    });
});

// ============================================================================
// 复杂场景测试
// ============================================================================

describe("深层嵌套状态空间", () => {
    it("应该处理三层嵌套的对象结构", () => {
        // 模拟复杂的编辑器状态
        const 编辑器状态 = type({
            编辑器: {
                文档: {
                    类型: "'markdown' | '富文本' | '代码'",
                    格式: "'普通' | '加密'"
                },
                选区: {
                    类型: "'collapsed' | 'range' | 'cross-block'",
                    位置: "number"
                }
            },
            快捷键: {
                组合: "string",
                修饰符: { ctrl: "boolean", shift: "boolean", alt: "boolean", meta: "boolean" }
            }
        });

        const dispatch = calibur.universe(编辑器状态)
            // Ctrl+S 保存（在处理器内部判断加密/普通）
            .split(
                type({
                    快捷键: { 组合: "'s'", 修饰符: { ctrl: "true" } }
                }),
                (state) => state.编辑器.文档.格式 === "加密"
                    ? { 命令: "加密保存", 文档类型: state.编辑器.文档.类型 }
                    : { 命令: "普通保存", 选区位置: state.编辑器.选区.位置 }
            )
            // 跨块选区时的删除
            .split(
                type({
                    编辑器: { 选区: { 类型: "'cross-block'" } },
                    快捷键: { 组合: "'Delete'" }
                }),
                () => ({ 命令: "跨块删除" })
            )
            .remain((state) => ({
                命令: "无匹配",
                快捷键: state.快捷键.组合
            }))
            .build();

        // 加密文档的Ctrl+S
        expect(dispatch({
            编辑器: {
                文档: { 类型: "markdown", 格式: "加密" },
                选区: { 类型: "collapsed", 位置: 100 }
            },
            快捷键: { 组合: "s", 修饰符: { ctrl: true, shift: false, alt: false, meta: false } }
        })).toEqual({ 命令: "加密保存", 文档类型: "markdown" });

        // 普通文档的Ctrl+S
        expect(dispatch({
            编辑器: {
                文档: { 类型: "富文本", 格式: "普通" },
                选区: { 类型: "range", 位置: 200 }
            },
            快捷键: { 组合: "s", 修饰符: { ctrl: true, shift: false, alt: false, meta: false } }
        })).toEqual({ 命令: "普通保存", 选区位置: 200 });

        // 跨块选区时的删除
        expect(dispatch({
            编辑器: {
                文档: { 类型: "代码", 格式: "普通" },
                选区: { 类型: "cross-block", 位置: 50 }
            },
            快捷键: { 组合: "Delete", 修饰符: { ctrl: false, shift: false, alt: false, meta: false } }
        })).toEqual({ 命令: "跨块删除" });

        // 其他快捷键
        expect(dispatch({
            编辑器: {
                文档: { 类型: "markdown", 格式: "普通" },
                选区: { 类型: "collapsed", 位置: 0 }
            },
            快捷键: { 组合: "a", 修饰符: { ctrl: false, shift: false, alt: false, meta: false } }
        })).toEqual({ 命令: "无匹配", 快捷键: "a" });
    });
});

describe("模拟keydown.ts的复杂分发", () => {
    it("应该处理编辑器键盘事件的状态空间", () => {
        // 模拟keydown.ts中的状态空间
        const 键盘事件状态 = type({
            按键: "string",
            键码: "number",
            修饰符: {
                ctrl: "boolean",
                shift: "boolean",
                alt: "boolean",
                meta: "boolean"
            },
            输入法激活: "boolean",
            块类型: "string",
            目标元素: "'protyle-html' | 'input' | 'contenteditable'",
            选区: {
                类型: "'collapsed' | 'range'",
                跨块: "boolean"
            },
            编辑器禁用: "boolean",
            面板: {
                hint: "boolean",
                菜单: "boolean",
                属性视图: "boolean"
            }
        });

        const dispatch = calibur.universe(键盘事件状态)
            // 守卫：输入法激活时跳过处理
            .split(
                type({ 输入法激活: "true" }),
                () => ({ 终止: true, 原因: "输入法处理中" })
            )
            // 守卫：编辑器禁用时跳过（输入法未激活的情况）
            .split(
                type({ 编辑器禁用: "true", 输入法激活: "false" }),
                () => ({ 终止: true, 原因: "编辑器已禁用" })
            )
            // Hint面板导航（输入法未激活，编辑器未禁用）
            .split(
                type({
                    按键: "'ArrowUp' | 'ArrowDown'",
                    面板: { hint: "true" },
                    输入法激活: "false",
                    编辑器禁用: "false"
                }),
                (state) => ({ 命令: "hint导航", 方向: state.按键 })
            )
            // 属性视图面板时拦截（输入法未激活，编辑器未禁用，hint面板未开启）
            .split(
                type({
                    面板: { 属性视图: "true", hint: "false" },
                    输入法激活: "false",
                    编辑器禁用: "false"
                }),
                () => ({ 终止: true, 原因: "属性视图面板已打开" })
            )
            // Enter键处理（在处理器内部根据修饰符判断）
            .split(
                type({
                    按键: "'Enter'",
                    输入法激活: "false",
                    编辑器禁用: "false",
                    面板: { 属性视图: "false", hint: "false" }
                }),
                (state) => {
                    if (state.修饰符.ctrl) return { 命令: "Ctrl+Enter行为" };
                    if (state.修饰符.shift) return { 命令: "软换行" };
                    if (state.修饰符.alt) return { 命令: "alt回车行为" };
                    return { 命令: "换行" };
                }
            )
            // Tab在特定块中（在处理器内部根据shift判断缩进/减缩进）
            .split(
                type({
                    按键: "'Tab'",
                    块类型: "'NodeList'",
                    输入法激活: "false",
                    编辑器禁用: "false",
                    面板: { 属性视图: "false", hint: "false" }
                }),
                (state) => ({ 命令: state.修饰符.shift ? "列表减缩进" : "列表缩进" })
            )
            // Delete键
            .split(
                type({
                    按键: "'Delete'",
                    输入法激活: "false",
                    编辑器禁用: "false",
                    面板: { 属性视图: "false", hint: "false" }
                }),
                (state) => ({
                    命令: "删除",
                    跨块: state.选区.跨块
                })
            )
            // Escape键
            .split(
                type({
                    按键: "'Escape'",
                    输入法激活: "false",
                    编辑器禁用: "false",
                    面板: { 属性视图: "false", hint: "false" }
                }),
                () => ({ 命令: "取消" })
            )
            .remain((state) => ({
                命令: "默认按键处理",
                按键: state.按键,
                块类型: state.块类型
            }))
            .build();

        const 基础状态 = {
            键码: 13,
            修饰符: { ctrl: false, shift: false, alt: false, meta: false },
            输入法激活: false,
            块类型: "NodeParagraph",
            目标元素: "contenteditable" as const,
            选区: { 类型: "collapsed" as const, 跨块: false },
            编辑器禁用: false,
            面板: { hint: false, 菜单: false, 属性视图: false }
        };

        // 输入法激活时
        expect(dispatch({ ...基础状态, 按键: "a", 输入法激活: true }))
            .toEqual({ 终止: true, 原因: "输入法处理中" });

        // 编辑器禁用时
        expect(dispatch({ ...基础状态, 按键: "Enter", 编辑器禁用: true }))
            .toEqual({ 终止: true, 原因: "编辑器已禁用" });

        // Hint面板导航
        expect(dispatch({ ...基础状态, 按键: "ArrowDown", 面板: { hint: true, 菜单: false, 属性视图: false } }))
            .toEqual({ 命令: "hint导航", 方向: "ArrowDown" });

        // Ctrl+Enter
        expect(dispatch({ ...基础状态, 按键: "Enter", 修饰符: { ...基础状态.修饰符, ctrl: true } }))
            .toEqual({ 命令: "Ctrl+Enter行为" });

        // Shift+Enter
        expect(dispatch({ ...基础状态, 按键: "Enter", 修饰符: { ...基础状态.修饰符, shift: true } }))
            .toEqual({ 命令: "软换行" });

        // 普通Enter
        expect(dispatch({ ...基础状态, 按键: "Enter" }))
            .toEqual({ 命令: "换行" });

        // 列表中的Tab
        expect(dispatch({ ...基础状态, 按键: "Tab", 块类型: "NodeList" }))
            .toEqual({ 命令: "列表缩进" });

        // Delete键处理
        expect(dispatch({ ...基础状态, 按键: "Delete", 选区: { 类型: "range", 跨块: true } }))
            .toEqual({ 命令: "删除", 跨块: true });

        // 普通字符
        expect(dispatch({ ...基础状态, 按键: "a" }))
            .toEqual({ 命令: "默认按键处理", 按键: "a", 块类型: "NodeParagraph" });
    });
});

describe("类型收窄测试", () => {
    it("模式中的属性应该在处理器中收窄", () => {
        const 全集 = type({
            动作: "'点击' | '悬停' | '拖拽'",
            目标: { 类型: "'按钮' | '链接' | '图片'", id: "string" },
            位置: { x: "number", y: "number" }
        });

        const dispatch = calibur.universe(全集)
            .split(
                type({ 动作: "'点击'", 目标: { 类型: "'按钮'" } }),
                (state) => {
                    // state.动作 类型应该是 '点击' (收窄了)
                    // state.目标.类型 类型应该是 '按钮' (收窄了)
                    // state.位置 仍然是 { x: number, y: number } (保留全集)
                    return `点击按钮 ${state.目标.id} at (${state.位置.x}, ${state.位置.y})`;
                }
            )
            .split(
                type({ 动作: "'拖拽'" }),
                (state) => {
                    // state.动作 是 '拖拽'
                    // state.目标 保留全集类型
                    return `拖拽 ${state.目标.类型}: ${state.目标.id}`;
                }
            )
            .remain((state) => `其他: ${state.动作} on ${state.目标.类型}`)
            .build();

        expect(dispatch({
            动作: "点击",
            目标: { 类型: "按钮", id: "submit-btn" },
            位置: { x: 100, y: 200 }
        })).toBe("点击按钮 submit-btn at (100, 200)");

        expect(dispatch({
            动作: "拖拽",
            目标: { 类型: "图片", id: "photo-1" },
            位置: { x: 50, y: 60 }
        })).toBe("拖拽 图片: photo-1");

        expect(dispatch({
            动作: "悬停",
            目标: { 类型: "链接", id: "link-1" },
            位置: { x: 0, y: 0 }
        })).toBe("其他: 悬停 on 链接");
    });
});

describe("嵌套路由（分层分发）", () => {
    it("应该支持将另一个calibur分发器作为处理器", () => {
        // 第一层：按块类型分发
        // 第二层：每个块类型有自己的按键处理

        // 代码块的按键处理器
        const 代码块处理器 = calibur.universe(type({
            按键: "string",
            修饰符: { ctrl: "boolean", shift: "boolean" }
        }))
            .split(
                type({ 按键: "'Tab'" }),
                () => ({ 命令: "代码块缩进", 块: "代码块" })
            )
            .split(
                type({ 按键: "'Enter'" }),
                () => ({ 命令: "代码块换行", 块: "代码块" })
            )
            .remain(() => ({ 命令: "代码块默认", 块: "代码块" }))
            .build();

        // 列表的按键处理器
        const 列表处理器 = calibur.universe(type({
            按键: "string",
            修饰符: { ctrl: "boolean", shift: "boolean" }
        }))
            .split(
                type({ 按键: "'Tab'" }),
                // 在处理器内部判断 shift
                (state) => ({ 命令: state.修饰符.shift ? "列表减缩进" : "列表缩进", 块: "列表" })
            )
            .split(
                type({ 按键: "'Enter'" }),
                () => ({ 命令: "列表新项", 块: "列表" })
            )
            .remain(() => ({ 命令: "列表默认", 块: "列表" }))
            .build();

        // 顶层路由：按块类型分发到子路由
        const 顶层分发 = calibur.universe(type({
            块类型: "'代码块' | '列表' | '段落'",
            按键: "string",
            修饰符: { ctrl: "boolean", shift: "boolean" }
        }))
            .split(
                type({ 块类型: "'代码块'" }),
                // 嵌套路由：将状态委托给代码块处理器
                (state) => 代码块处理器({ 按键: state.按键, 修饰符: state.修饰符 })
            )
            .split(
                type({ 块类型: "'列表'" }),
                // 嵌套路由：将状态委托给列表处理器
                (state) => 列表处理器({ 按键: state.按键, 修饰符: state.修饰符 })
            )
            .remain(() => ({ 命令: "默认段落处理", 块: "段落" }))
            .build();

        // 测试代码块中的Tab
        expect(顶层分发({
            块类型: "代码块",
            按键: "Tab",
            修饰符: { ctrl: false, shift: false }
        })).toEqual({ 命令: "代码块缩进", 块: "代码块" });

        // 测试代码块中的Enter
        expect(顶层分发({
            块类型: "代码块",
            按键: "Enter",
            修饰符: { ctrl: false, shift: false }
        })).toEqual({ 命令: "代码块换行", 块: "代码块" });

        // 测试列表中的Tab
        expect(顶层分发({
            块类型: "列表",
            按键: "Tab",
            修饰符: { ctrl: false, shift: false }
        })).toEqual({ 命令: "列表缩进", 块: "列表" });

        // 测试列表中的Enter
        expect(顶层分发({
            块类型: "列表",
            按键: "Enter",
            修饰符: { ctrl: false, shift: false }
        })).toEqual({ 命令: "列表新项", 块: "列表" });

        // 测试段落中的任意键（走默认）
        expect(顶层分发({
            块类型: "段落",
            按键: "Enter",
            修饰符: { ctrl: false, shift: false }
        })).toEqual({ 命令: "默认段落处理", 块: "段落" });
    });

    it("应该支持多层嵌套分发", () => {
        // 三层嵌套：模式 -> 块类型 -> 按键

        // 第三层：具体按键处理
        const 创建按键处理器 = (模式名: string, 块名: string) =>
            calibur.universe(type({ 按键: "string" }))
                .split(
                    type({ 按键: "'Enter'" }),
                    () => `${模式名}/${块名}/Enter`
                )
                .split(
                    type({ 按键: "'Tab'" }),
                    () => `${模式名}/${块名}/Tab`
                )
                .remain((state) => `${模式名}/${块名}/其他`)
                .build();

        // 第二层：块类型分发
        const 创建块处理器 = (模式名: string) =>
            calibur.universe(type({ 块类型: "'代码' | '文本'", 按键: "string" }))
                .split(
                    type({ 块类型: "'代码'" }),
                    (state) => 创建按键处理器(模式名, "代码")({ 按键: state.按键 })
                )
                .split(
                    type({ 块类型: "'文本'" }),
                    (state) => 创建按键处理器(模式名, "文本")({ 按键: state.按键 })
                )
                .build();

        // 第一层：模式分发
        const 顶层 = calibur.universe(type({
            模式: "'编辑' | '预览'",
            块类型: "'代码' | '文本'",
            按键: "string"
        }))
            .split(
                type({ 模式: "'编辑'" }),
                (state) => 创建块处理器("编辑")({ 块类型: state.块类型, 按键: state.按键 })
            )
            .split(
                type({ 模式: "'预览'" }),
                (state) => 创建块处理器("预览")({ 块类型: state.块类型, 按键: state.按键 })
            )
            // 编辑与预览已覆盖完整模式空间。
            .build();

        // 测试三层嵌套
        expect(顶层({ 模式: "编辑", 块类型: "代码", 按键: "Enter" }))
            .toBe("编辑/代码/Enter");

        expect(顶层({ 模式: "编辑", 块类型: "文本", 按键: "Tab" }))
            .toBe("编辑/文本/Tab");

        expect(顶层({ 模式: "预览", 块类型: "代码", 按键: "a" }))
            .toBe("预览/代码/其他");

        expect(顶层({ 模式: "预览", 块类型: "文本", 按键: "Enter" }))
            .toBe("预览/文本/Enter");
    });

    it("应该在子分发器全集不是模式子集时报错", () => {
        // 创建一个处理"列表"块类型的分发器
        const 列表处理器 = calibur.universe(type({
            块类型: "'列表'",
            按键: "string"
        }))
            .split(type({ 按键: "'Tab'" }), () => "列表缩进")
            .remain(() => "列表其他")
            .build();

        // 尝试把列表处理器注册到"段落"模式上应该报错
        // 因为列表处理器的全集 { 块类型: '列表', ... } 不是 { 块类型: '段落', ... } 的子集
        expect(() => {
            calibur.universe(type({
                块类型: "'段落' | '列表'",
                按键: "string"
            }))
                .split(
                    type({ 块类型: "'段落'" }),
                    // @ts-expect-error
                    列表处理器,  // 子分发器
                    () => "fallback"     // fallback 处理器
                )
                .remain(() => "其他")
                .build();
        }).toThrow("嵌套分发器的全集不是当前模式的子集");
    });

    it("应该允许正确的子分发器嵌套", () => {
        // 创建一个处理"段落"块类型的分发器
        const 段落处理器 = calibur.universe(type({
            块类型: "'段落'",
            按键: "string"
        }))
            .split(type({ 按键: "'Enter'" }), () => "段落换行")
            .remain(() => "段落其他")
            .build();

        // 段落处理器的全集是 { 块类型: '段落', ... }
        // 注册到 { 块类型: '段落', ... } 模式上是正确的
        const 顶层 = calibur.universe(type({
            块类型: "'段落' | '列表'",
            按键: "string"
        }))
            .split(
                type({ 块类型: "'段落'" }),
                段落处理器,
                () => "段落 fallback"  // fallback（不会被调用因为子分发器有remain）
            )
            .remain(() => "其他块类型")
            .build();

        expect(顶层({ 块类型: "段落", 按键: "Enter" })).toBe("段落换行");
        expect(顶层({ 块类型: "段落", 按键: "a" })).toBe("段落其他");
        expect(顶层({ 块类型: "列表", 按键: "Tab" })).toBe("其他块类型");
    });

    it("应该在分发器作为处理器但没有提供fallback时报错", () => {
        const 子处理器 = calibur.universe(type({ 按键: "'Enter'" }))
            .remain(() => "处理")
            .build();

        expect(() => {
            calibur.universe(type({ 按键: "string" }))
                .split(
                    type({ 按键: "'Enter'" }),
                    // @ts-expect-error
                    子处理器   // 没有提供 fallback
                )
                .remain(() => "其他")
                .build();
        }).toThrow("必须提供第三参数 fallback 处理器");
    });

    it("fallback处理器应该处理子分发器未覆盖的情况", () => {
        // 子分发器只处理 Enter
        const 子处理器 = calibur.universe(type({ 按键: "'Enter'" }))
            .remain(() => "子处理器处理Enter")
            .build();

        // 父模式包含 Enter 和 Tab
        const 顶层 = calibur.universe(type({
            按键: "'Enter' | 'Tab'"
        }))
            .split(
                type({ 按键: "'Enter' | 'Tab'" }),  // 模式匹配两者
                子处理器,
                () => "fallback处理Tab"  // 子分发器不处理Tab时调用
            )
            .build();

        expect(顶层({ 按键: "Enter" })).toBe("子处理器处理Enter");
        expect(顶层({ 按键: "Tab" })).toBe("fallback处理Tab");
    });
});

