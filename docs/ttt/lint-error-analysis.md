# Lint 错误分析报告

生成时间: 2026-02-23T05:46:55Z

## 使用的 Lint 命令

```bash
# package.json 中定义的命令
pnpm lint:top --json -n 20   # 使用项目内置的 lint-top-errors.js 脚本
# 底层调用: eslint . --cache (eslint.config.mjs 配置)
```

## 总体统计

| 指标 | 数值 |
|------|------|
| 扫描文件总数 | 1082 |
| 有问题的文件数 | 850 (78.6%) |
| 总错误数 | 30,385 |
| 总警告数 | 218 |

## 错误最多的前 20 个文件

| # | 文件路径 | 错误 | 警告 | 总计 |
|---|----------|------|------|------|
| 1 | src/protyle/wysiwyg/index.ts | 1002 | 1 | 1003 |
| 2 | src/protyle/wysiwyg/transaction.ts | 556 | 0 | 556 |
| 3 | src/protyle/render/av/cell.ts | 540 | 0 | 540 |
| 4 | src/protyle/render/av/openMenuPanel.ts | 440 | 0 | 440 |
| 5 | src/layout/Wnd.ts | 360 | 0 | 360 |
| 6 | src/protyle/hint/index.ts | 350 | 0 | 350 |
| 7 | src/layout/dock/index.backup.ts | 331 | 0 | 331 |
| 8 | src/layout/dock/index.old.ts | 330 | 0 | 330 |
| 9 | src/protyle/render/av/filter.ts | 314 | 0 | 314 |
| 10 | src/mobile/util/keyboardToolbar.ts | 313 | 0 | 313 |
| 11 | src/protyle/render/av/render.ts | 302 | 0 | 302 |
| 12 | src/protyle/util/selection.ts | 302 | 0 | 302 |
| 13 | src/emoji/index.ts | 295 | 0 | 295 |
| 14 | src/search/utils/genSearch.old.ts | 294 | 0 | 294 |
| 15 | src/mobile/dock/MobileFiles.ts | 289 | 0 | 289 |
| 16 | src/history/history.ts | 277 | 0 | 277 |
| 17 | src/config/repos.ts | 273 | 0 | 273 |
| 18 | src/mobile/menu/search.ts | 268 | 0 | 268 |
| 19 | src/mobile/dock/MobileOutline.ts | 266 | 0 | 266 |
| 20 | src/protyle/render/av/action.ts | 265 | 0 | 265 |

## 每个文件的主要错误类型分布 (Top 5 规则)

### 1. src/protyle/wysiwyg/index.ts (1003)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 633 |
| require-if-comment/require-if-comment | 242 |
| no-inline-callback/no-inline-callback | 46 |
| no-restricted-globals | 42 |
| function-comment/require-function-comment | 15 |

### 2. src/protyle/wysiwyg/transaction.ts (556)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 332 |
| require-if-comment/require-if-comment | 120 |
| no-inline-callback/no-inline-callback | 42 |
| no-restricted-globals | 24 |
| function-comment/require-function-comment | 17 |

### 3. src/protyle/render/av/cell.ts (540)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 352 |
| require-if-comment/require-if-comment | 101 |
| function-comment/require-function-comment | 20 |
| no-inline-callback/no-inline-callback | 17 |
| require-async-export/require-async-export | 13 |

### 4. src/protyle/render/av/openMenuPanel.ts (440)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 305 |
| require-if-comment/require-if-comment | 64 |
| no-restricted-globals | 32 |
| no-inline-callback/no-inline-callback | 24 |
| code-size/max-lines-per-function | 5 |

### 5. src/layout/Wnd.ts (360)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 179 |
| require-if-comment/require-if-comment | 87 |
| no-restricted-globals | 44 |
| no-inline-callback/no-inline-callback | 24 |
| function-comment/require-function-comment | 14 |

### 6. src/protyle/hint/index.ts (350)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 220 |
| require-if-comment/require-if-comment | 75 |
| no-inline-callback/no-inline-callback | 17 |
| no-restricted-globals | 15 |
| function-comment/require-function-comment | 12 |

### 7. src/layout/dock/index.backup.ts (331)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 199 |
| require-if-comment/require-if-comment | 69 |
| no-restricted-globals | 23 |
| function-comment/require-function-comment | 19 |
| no-inline-callback/no-inline-callback | 11 |

### 8. src/layout/dock/index.old.ts (330)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 199 |
| require-if-comment/require-if-comment | 69 |
| no-restricted-globals | 23 |
| function-comment/require-function-comment | 19 |
| no-inline-callback/no-inline-callback | 11 |

### 9. src/protyle/render/av/filter.ts (314)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 199 |
| require-if-comment/require-if-comment | 60 |
| no-inline-callback/no-inline-callback | 20 |
| function-comment/require-function-comment | 13 |
| no-large-inline-array/no-large-inline-array | 9 |

### 10. src/mobile/util/keyboardToolbar.ts (313)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 150 |
| no-restricted-globals | 69 |
| require-if-comment/require-if-comment | 49 |
| function-comment/require-function-comment | 10 |
| no-inline-callback/no-inline-callback | 9 |

### 11. src/protyle/render/av/render.ts (302)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 181 |
| require-if-comment/require-if-comment | 62 |
| no-inline-callback/no-inline-callback | 29 |
| function-comment/require-function-comment | 11 |
| code-size/max-lines-per-function | 7 |

### 12. src/protyle/util/selection.ts (302)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 205 |
| require-if-comment/require-if-comment | 53 |
| function-comment/require-function-comment | 16 |
| require-async-export/require-async-export | 15 |
| code-size/max-lines-per-function | 5 |

### 13. src/emoji/index.ts (295)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 168 |
| require-if-comment/require-if-comment | 38 |
| no-restricted-globals | 34 |
| no-inline-callback/no-inline-callback | 21 |
| function-comment/require-function-comment | 15 |

### 14. src/search/utils/genSearch.old.ts (294)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 183 |
| no-restricted-globals | 46 |
| require-if-comment/require-if-comment | 35 |
| no-inline-callback/no-inline-callback | 16 |
| function-comment/require-function-comment | 7 |

### 15. src/mobile/dock/MobileFiles.ts (289)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 164 |
| require-if-comment/require-if-comment | 45 |
| no-restricted-globals | 43 |
| function-comment/require-function-comment | 15 |
| no-inline-callback/no-inline-callback | 15 |

### 16. src/history/history.ts (277)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 187 |
| require-if-comment/require-if-comment | 34 |
| no-inline-callback/no-inline-callback | 21 |
| no-restricted-globals | 19 |
| function-comment/require-function-comment | 8 |

### 17. src/config/repos.ts (273)

| 规则 | 数量 |
|------|------|
| no-restricted-globals | 134 |
| no-restricted-syntax | 82 |
| require-if-comment/require-if-comment | 32 |
| no-inline-callback/no-inline-callback | 14 |
| code-size/max-lines-per-function | 6 |

### 18. src/mobile/menu/search.ts (268)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 164 |
| require-if-comment/require-if-comment | 44 |
| no-inline-callback/no-inline-callback | 19 |
| no-restricted-globals | 16 |
| function-comment/require-function-comment | 13 |

### 19. src/mobile/dock/MobileOutline.ts (266)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 128 |
| no-restricted-globals | 45 |
| require-if-comment/require-if-comment | 39 |
| function-comment/require-function-comment | 28 |
| no-inline-callback/no-inline-callback | 18 |

### 20. src/protyle/render/av/action.ts (265)

| 规则 | 数量 |
|------|------|
| no-restricted-syntax | 164 |
| require-if-comment/require-if-comment | 45 |
| function-comment/require-function-comment | 21 |
| no-inline-callback/no-inline-callback | 15 |
| no-restricted-globals | 8 |

## 备注

- `index.backup.ts`、`index.old.ts`、`genSearch.old.ts` 为备份/旧文件，可考虑从lint范围排除
- 主要错误集中在 `no-restricted-syntax`（禁止else/嵌套if/forEach/switch等）和 `require-if-comment`（要求if注释）
