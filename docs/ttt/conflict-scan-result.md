# 冲突标记扫描结果

扫描时间: 2026-02-19T21:17 (UTC+8)

## 扫描方法

使用 `search_files` 工具对18个 "both modified" 文件搜索 `<<<<<<<`、`=======`、`>>>>>>>` 冲突标记。

## 有冲突标记的文件（18/18）

全部18个文件均包含未解决的冲突标记：

| # | 文件 | `<<<<<<<` 所在行 |
|---|------|-----------------|
| 1 | app/package.json | 95 |
| 2 | app/pnpm-lock.yaml | 149, 2072, 3470, 3735, 4503, 4649, 4695, 6938, 8646, 8889, 9696, 9812, 9878 |
| 3 | app/src/boot/onGetConfig.ts | 8 |
| 4 | app/src/card/openCard.ts | 110 |
| 5 | app/src/config/fileTree.ts | 49, 162 |
| 6 | app/src/layout/dock/Bookmark.ts | 35 |
| 7 | app/src/layout/dock/Files.ts | 66 |
| 8 | app/src/layout/dock/Tag.ts | 34 |
| 9 | app/src/menus/protyle.ts | 19, 95 |
| 10 | app/src/menus/util.ts | 14 |
| 11 | app/src/mobile/index.ts | 210 |
| 12 | app/src/protyle/gutter/index.ts | 5, 155 |
| 13 | app/src/protyle/render/av/asset.ts | 1, 267 |
| 14 | app/src/protyle/ui/hideElements.ts | 1 |
| 15 | app/src/protyle/ui/initUI.ts | 21 |
| 16 | app/src/protyle/wysiwyg/remove.ts | 173 |
| 17 | app/src/search/util.ts | 64 |
| 18 | app/src/window/init.ts | 1, 135 |

## 无冲突标记的文件

无。

## 结论

全部18个 "both modified" 文件均仍包含冲突标记，无一已解决。其中 pnpm-lock.yaml 冲突最多（13处），多数 .ts 文件有1-2处冲突区块。
