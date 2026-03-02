import { describe, expect, it } from "vitest";
import { createLineDiffEngine } from "./diff.engine";

/**
 * 作用：验证引擎能输出基础行级差异与摘要统计。
 * 意图：保证公共算法层在常见编辑场景下输出稳定。
 * 调用时机：diff.engine 单测执行时调用。
 * 问题/改进：后续可补充空白字符和超长文本边界测试。
 */
function shouldBuildLineLevelModel(): void {
    const engine = createLineDiffEngine();
    const model = engine.build({
        oldText: "alpha\nbeta\ngamma\n",
        newText: "alpha\nbeta-changed\ngamma\ndelta\n",
        fileName: "sample.txt",
        contextLines: 1,
    });

    expect(model.granularity).toBe("line");
    expect(model.summary.addedLines).toBe(2);
    expect(model.summary.removedLines).toBe(1);
    expect(model.hunks.length).toBeGreaterThan(0);
}

/**
 * 作用：验证无差异输入时返回空 hunk。
 * 意图：保证渲染层可以按“无差异”分支处理。
 * 调用时机：diff.engine 单测执行时调用。
 * 问题/改进：后续可加入换行符差异场景断言。
 */
function shouldReturnEmptyHunksWhenNoChange(): void {
    const engine = createLineDiffEngine();
    const model = engine.build({
        oldText: "same\ncontent\n",
        newText: "same\ncontent\n",
    });

    expect(model.hunks).toHaveLength(0);
    expect(model.summary.addedLines).toBe(0);
    expect(model.summary.removedLines).toBe(0);
}

/** @同步豁免: 测试用例声明 — describe/it 需要同步注册测试函数 */
/**
 * 作用：组织 diff.engine 测试集合。
 * 意图：按行为划分公共引擎的基础回归用例。
 * 调用时机：vitest 加载本文件时调用。
 * 问题/改进：后续可拆分为 parser/render 协同测试。
 */
function runDiffEngineSuite(): void {
    it("应构建行级差异模型并统计摘要", shouldBuildLineLevelModel);
    it("无差异时应返回空 hunk 与零增删计数", shouldReturnEmptyHunksWhenNoChange);
}

describe("diff.engine", runDiffEngineSuite);

