/**
 * S-Forge 墓碑文件（Tombstone）
 * 本文件在本地分支被有意删除：架构重构（commit 09fed755b8「改进代码组织,清理lint错误」）将单文件 PDF 标注模块拆分为 anno/ 目录模块，故 stage2=deleted。
 * 本地替代/迁移到：app/src/asset/anno/index.ts（initAnno/handleContainerClick 等）；app/src/asset/anno/config.ts（getConfig/setConfig）、constants.ts、imports.ts、anno.copy.ts、anno.getHighlight.ts、anno.getHightlightCoordsByRange.ts、anno.getHightlightCoordsByRect.ts、anno.getRelationHTML.ts、anno.getRectImgData.ts、anno.getCaptureCanvas.ts、anno.hlPDFRect.ts、anno.hideToolbar.ts、anno.initRectAnnoTool.ts、anno.getPdfInstance.ts、anno.resize.ts、anno.setRelation.ts、anno.showHighlight.ts、anno.showToolbar.ts、anno.types.ts、click/*、text/getTextNode.ts、state/selection.ts。
 * 上游 v3.8.0 对该文件的增量（经评审）：
 *   1. 安全加固（GHSA-fqpw-c3pj-w8g9）：新增 getRectElementsByNodeId 以属性值比较替代 CSS 选择器插值；showHighlight 改用 createElement/setAttribute 构建 DOM，不再拼接 HTML 字符串；getRelationHTML 用 escapeAttr/escapeHtml 转义 .sya 中的 ID。
 *   2. 矩形标注拖拽/缩放：新增 mousedown(capture) 拖动与四角 resize 手柄（.pdf__rect-resize）、ignoreRectClick 抑制误点击，依赖上游新兄弟模块 rectAnnotationResize.ts。
 *   3. 矩形截图重构：getRectImgData 仅截取标注区域（offsetX/offsetY viewport）、旋转感知、canvas.toBlob 输出 Blob，图片名加入 md5 位置哈希，上传改走 uploadStandaloneAssetFiles/getAssetUploadSuccesses，依赖新兄弟模块 pdfRectCapture.ts 与 blueimp-md5。
 *   4. 渲染与健壮性：.pdf__rects 层自 textLayer 移至 page 元素并同步 width/height/transform/data-main-rotation；拖拽背景改用 color-mix 半透明；positions 类型修正为 number[][]；getConfig 的 JSON.parse 增加 try/catch。
 * 增量去向：TODO 移植清单（本地 anno/ 模块尚未包含上述任何增量；且上游依赖的 util/escape、protyle/upload/uploadStandaloneAssetFiles、blueimp-md5 在本地 app/src 中不存在，移植时需一并引入或按本地等价物适配）：
 *   项1 → anno.hlPDFRect.ts / anno.showHighlight.ts / anno.getRelationHTML.ts / click.ts；
 *   项2 → 与本地 anno.resize.ts（initResizeHandler）对齐后合并；
 *   项3 → anno.getRectImgData.ts + anno.getCaptureCanvas.ts + anno.copy.ts；
 *   项4 → anno.showHighlight.ts + config.ts。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 * 2026-08-27 补记（已验证）：项2 矩形标注拖拽/缩放已在分割架构中完整移植：rectAnnotationResize.ts（resizeRectBounds/moveRectBounds/hideRectResizeHandles/getRectImageName 可选 captureProfile）→ anno.showToolbar.ts（selected/resize 手柄、direction、setPosition 含 targetHeight）→ anno.hideToolbar.ts（hideElements 清理）→ anno.dragResize.ts（capture mousedown/move/resize、阈值 Constants.SIZE_DRAG_THRESHOLD、ignoreRectClick、配置持久化）→ anno.copy.ts（positionHash + getRectImageName 含 PDF_RECT_CAPTURE_PROFILE）→ hideElements.ts 全局清理、SCSS _pdf.scss 已与上游 4 个 commit 终态一致；该项 TODO 已过期，其余项仍待评估。
 */
export {};
