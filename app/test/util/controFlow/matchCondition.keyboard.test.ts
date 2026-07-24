import { describe, test, expect, vi, beforeEach } from "vitest";
import { createTypedMatcher } from "../../../src/util/lib/matchCondition";


// 模拟平台检测
const mockIsMac = vi.fn();
vi.mock("../../../src/protyle/util/compatibility", () => ({
  isMac: mockIsMac,
  isNotCtrl: vi.fn((event: KeyboardEvent) => !event.ctrlKey && !event.metaKey),
  isOnlyMeta: vi.fn((event: KeyboardEvent) => event.metaKey && !event.ctrlKey)
}));

describe("matchCondition - 键盘事件场景测试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 测试 Mac 平台下的 Ctrl+B 场景
  test("应该在 Mac 平台表格块中按下 Ctrl+B 时匹配", () => {
    // 设置为 Mac 平台
    mockIsMac.mockReturnValue(true);
    
    // 创建匹配器：Mac 平台 + 表格块 + Ctrl+B
    const tableBoldMatcher = createTypedMatcher(
      { 
        platform: "mac",
        blockType: "table",
        hotkey: "ctrl+b"
      },
      () => ({ action: "bold", context: "table-cell" })
    );

    // 模拟 Mac 平台表格块中的 Ctrl+B 事件
    const conditions = {
      platform: "mac",
      blockType: "table",
      hotkey: "ctrl+b"
    };

    const result = tableBoldMatcher(conditions);
    
    expect(result).toBeDefined();
    expect(result?.matched).toBe(true);
    expect(result?.payload).toEqual({ action: "bold", context: "table-cell" });
  });

  // 测试 Windows 平台下的 Ctrl+B 场景
  test("应该在 Windows 平台表格块中按下 Ctrl+B 时匹配", () => {
    // 设置为 Windows 平台
    mockIsMac.mockReturnValue(false);
    
    // 创建匹配器：Windows 平台 + 表格块 + Ctrl+B
    const tableBoldMatcher = createTypedMatcher(
      { 
        platform: "windows",
        blockType: "table",
        hotkey: "ctrl+b"
      },
      () => ({ action: "bold", context: "table-cell" })
    );

    // 模拟 Windows 平台表格块中的 Ctrl+B 事件
    const conditions = {
      platform: "windows",
      blockType: "table",
      hotkey: "ctrl+b"
    };

    const result = tableBoldMatcher(conditions);
    
    expect(result).toBeDefined();
    expect(result?.matched).toBe(true);
    expect(result?.payload).toEqual({ action: "bold", context: "table-cell" });
  });

  // 测试 Mac 平台下的 Cmd+B 场景
  test("应该在 Mac 平台表格块中按下 Cmd+B 时匹配", () => {
    // 设置为 Mac 平台
    mockIsMac.mockReturnValue(true);
    
    // 创建匹配器：Mac 平台 + 表格块 + Cmd+B
    const tableBoldMatcher = createTypedMatcher(
      { 
        platform: "mac",
        blockType: "table",
        hotkey: "cmd+b"
      },
      () => ({ action: "bold", context: "table-cell" })
    );

    // 模拟 Mac 平台表格块中的 Cmd+B 事件
    const conditions = {
      platform: "mac",
      blockType: "table",
      hotkey: "cmd+b"
    };

    const result = tableBoldMatcher(conditions);
    
    expect(result).toBeDefined();
    expect(result?.matched).toBe(true);
    expect(result?.payload).toEqual({ action: "bold", context: "table-cell" });
  });

  // 测试平台不匹配情况
  test("应该在平台不匹配时返回 undefined", () => {
    // 设置为 Mac 平台
    mockIsMac.mockReturnValue(true);
    
    // 创建匹配器：Windows 平台 + 表格块 + Ctrl+B
    const tableBoldMatcher = createTypedMatcher(
      { 
        platform: "windows",
        blockType: "table",
        hotkey: "ctrl+b"
      },
      () => ({ action: "bold", context: "table-cell" })
    );

    // 模拟 Mac 平台表格块中的 Ctrl+B 事件（平台不匹配）
    const conditions = {
      platform: "mac",
      blockType: "table",
      hotkey: "ctrl+b"
    };

    const result = tableBoldMatcher(conditions);
    
    expect(result).toBeUndefined();
  });

  // 测试块类型不匹配情况
  test("应该在块类型不匹配时返回 undefined", () => {
    // 设置为 Mac 平台
    mockIsMac.mockReturnValue(true);
    
    // 创建匹配器：Mac 平台 + 表格块 + Ctrl+B
    const tableBoldMatcher = createTypedMatcher(
      { 
        platform: "mac",
        blockType: "table",
        hotkey: "ctrl+b"
      },
      () => ({ action: "bold", context: "table-cell" })
    );

    // 模拟 Mac 平台代码块中的 Ctrl+B 事件（块类型不匹配）
    const conditions = {
      platform: "mac",
      blockType: "code",
      hotkey: "ctrl+b"
    };

    const result = tableBoldMatcher(conditions);
    
    expect(result).toBeUndefined();
  });

  // 测试快捷键不匹配情况
  test("应该在快捷键不匹配时返回 undefined", () => {
    // 设置为 Mac 平台
    mockIsMac.mockReturnValue(true);
    
    // 创建匹配器：Mac 平台 + 表格块 + Ctrl+B
    const tableBoldMatcher = createTypedMatcher(
      { 
        platform: "mac",
        blockType: "table",
        hotkey: "ctrl+b"
      },
      () => ({ action: "bold", context: "table-cell" })
    );

    // 模拟 Mac 平台表格块中的 Ctrl+I 事件（快捷键不匹配）
    const conditions = {
      platform: "mac",
      blockType: "table",
      hotkey: "ctrl+i"
    };

    const result = tableBoldMatcher(conditions);
    
    expect(result).toBeUndefined();
  });
});
