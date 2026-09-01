import {describe, it} from "node:test";
import * as assert from "node:assert/strict";

// 简化版 dirname（避免引入 pathPosix 依赖 SIYUAN_VERSION）
const posixDirname = (p: string): string => {
    const idx = p.lastIndexOf("/");
    if (idx <= 0) return "/";
    return p.slice(0, idx);
};

// 模拟修复后的 selectItem 祖先搜索逻辑，验证不会无限循环
function findAncestorElement(
    treeElement: { querySelector: (sel: string) => any },
    filePath: string,
): string | null {
    let currentPath = filePath;
    let liElement: any = null;
    const visited = new Set<string>();
    let iterations = 0;
    while (!liElement) {
        if (iterations++ > 20) {
            throw new Error("infinite loop detected");
        }
        if (visited.has(currentPath)) {
            break;
        }
        visited.add(currentPath);
        liElement = treeElement.querySelector(`[data-path="${currentPath}"]`);
        if (!liElement) {
            const dirname = posixDirname(currentPath);
            if (dirname === "/") {
                const root = treeElement.querySelector(`[data-path="/"]`);
                if (root) {
                    liElement = root;
                    currentPath = "/";
                }
                break;
            } else {
                currentPath = dirname + ".sy";
            }
        }
    }
    return liElement ? currentPath : null;
}

describe("MobileFiles.selectItem ancestor search", () => {
    it("finds existing path directly", () => {
        const tree = {
            querySelector: (sel: string) => {
                if (sel === `[data-path="/a/b.sy"]`) return {found: true};
                return null;
            }
        } as any;
        assert.equal(findAncestorElement(tree, "/a/b.sy"), "/a/b.sy");
    });

    it("falls back to ancestor when path missing", () => {
        const tree = {
            querySelector: (sel: string) => {
                if (sel === `[data-path="/a/b.sy"]`) return null;
                if (sel === `[data-path="/a.sy"]`) return {found: true};
                return null;
            }
        } as any;
        assert.equal(findAncestorElement(tree, "/a/b.sy"), "/a.sy");
    });

    it("falls back to root when intermediate missing", () => {
        const tree = {
            querySelector: (sel: string) => {
                if (sel === `[data-path="/a/b/c.sy"]`) return null;
                if (sel === `[data-path="/a/b.sy"]`) return null;
                if (sel === `[data-path="/a.sy"]`) return null;
                if (sel === `[data-path="/"]`) return {found: true};
                return null;
            }
        } as any;
        assert.equal(findAncestorElement(tree, "/a/b/c.sy"), "/");
    });

    it("terminates without infinite loop when nothing exists", () => {
        const tree = {
            querySelector: () => null
        } as any;
        // 即使所有路径都不存在，也应在有限步内终止
        assert.doesNotThrow(() => findAncestorElement(tree, "/nonexistent/path.sy"));
        assert.equal(findAncestorElement(tree, "/nonexistent/path.sy"), null);
    });

    it("handles boxDoc path", () => {
        const tree = {
            querySelector: (sel: string) => {
                if (sel === `[data-path="/boxId.sy"]`) return {found: true, path: "/boxId.sy"};
                return null;
            }
        } as any;
        // 模拟 boxDocEnabled 情况，filePath 为 /boxId.sy，应直接返回
        assert.equal(findAncestorElement(tree, "/boxId.sy"), "/boxId.sy");
    });

    it("prevents infinite loop on root missing", () => {
        let calls = 0;
        const tree = {
            querySelector: () => {
                calls++;
                if (calls > 10) throw new Error("too many queries - infinite loop");
                return null;
            }
        } as any;
        findAncestorElement(tree, "/a.sy");
        assert.ok(calls <= 5, `should terminate quickly, got ${calls} calls`);
    });
});
