# commonMenuItem 目录重复函数调研报告

## 调研时间
2026-03-18

## 调研范围
`app/src/menus/commonMenuItem/` 目录

## 一、目录文件清单

该目录包含以下文件：

1. `index.ts` - 主入口文件，包含多个菜单项生成函数
2. `copy.ts` - 复制菜单相关功能
3. `openMenu.ts` - 打开方式菜单（重构版本）
4. `openFileAttr.ts` - 文件属性对话框（重构版本）
5. `openFileAttr.handlers.ts` - 文件属性对话框事件处理器
6. `commonMenuItem.openWechatNotify.ts` - 微信提醒对话框（重构版本）
7. `openFileWechatNotify.ts` - 文档微信提醒对话框
8. `index.ts.backup` - 备份文件

## 二、重复函数识别

### 2.1 严重重复：openWechatNotify

**重复位置：**
- `index.ts` (第47-110行)
- `commonMenuItem.openWechatNotify.ts` (第126-148行，导出函数)

**函数签名：**
```typescript
export const openWechatNotify = (nodeElement: Element) => { ... }
```

**重复情况分析：**
- 两个文件中都存在完整的 `openWechatNotify` 函数实现
- `index.ts` 中的版本是原始实现（64行代码）
- `commonMenuItem.openWechatNotify.ts` 中的版本是重构后的实现（23行主函数 + 多个辅助函数）
- 重构版本将逻辑拆分为：
  - `formatReminderDate` - 格式化提醒日期
  - `createWechatNotifyDialog` - 创建对话框
  - `handleRemoveButtonClick` - 处理删除按钮
  - `validateDateInput` - 验证日期输入
  - `handleConfirmButtonClick` - 处理确认按钮

**代码片段对比：**

`index.ts` 版本（原始）：
```typescript
export const openWechatNotify = (nodeElement: Element) => {
    const id = nodeElement.getAttribute("data-node-id");
    const range = getEditorRange(nodeElement);
    const reminder = nodeElement.getAttribute(Constants.CUSTOM_REMINDER_WECHAT);
    let reminderFormat = "";
    if (reminder) {
        reminderFormat = dayjs(reminder).format("YYYY-MM-DD HH:mm");
    }
    const dialog = new Dialog({
        width: isMobile() ? "92vw" : "50vw",
        title: siyuanI18n.wechatReminder,
        content: `<div class="b3-dialog__content custom-attr">...</div>`,
        destroyCallback() {
            focusByRange(range);
        }
    });
    // ... 后续逻辑
};
```

`commonMenuItem.openWechatNotify.ts` 版本（重构）：
```typescript
export const openWechatNotify = (nodeElement: Element) => {
    const id = nodeElement.getAttribute("data-node-id");
    const range = getEditorRange(nodeElement);
    const reminder = nodeElement.getAttribute(Constants.CUSTOM_REMINDER_WECHAT);
    const reminderFormat = formatReminderDate(reminder);
    const dialog = createWechatNotifyDialog(reminderFormat, range);
    // ... 使用辅助函数处理事件
};
```

**严重程度：高**
- 两个完全相同功能的函数同时存在
- 可能导致维护时只修改一处而遗漏另一处
- 增加代码体积和维护成本

---

### 2.2 严重重复：openFileWechatNotify

**重复位置：**
- `index.ts` (第112-166行)
- `openFileWechatNotify.ts` (第10-64行)

**函数签名：**
```typescript
export const openFileWechatNotify = (protyle: IProtyle) => { ... }
```

**重复情况分析：**
- 两个文件中都存在完整的 `openFileWechatNotify` 函数实现
- 两个版本的实现几乎完全相同（55行代码）
- 都是为文档级别设置微信提醒
- 没有进行重构拆分

**代码片段：**
```typescript
export const openFileWechatNotify = (protyle: IProtyle) => {
    fetchPost("/api/block/getDocInfo", {
        id: protyle.block.rootID
    }, (response) => {
        const reminder = response.data.ial[Constants.CUSTOM_REMINDER_WECHAT];
        let reminderFormat = "";
        if (reminder) {
            reminderFormat = dayjs(reminder).format("YYYY-MM-DD HH:mm");
        }
        const dialog = new Dialog({
            width: isMobile() ? "92vw" : "50vw",
            title: siyuanI18n.wechatReminder,
            content: `<div class="b3-dialog__content custom-attr">...</div>`
        });
        // ... 事件处理逻辑
    });
};
```

**严重程度：高**
- 完全重复的函数实现
- 两个版本代码几乎一致
- 存在同步维护风险

---

### 2.3 严重重复：openMenu

**重复位置：**
- `index.ts` (第487-620行)
- `openMenu.ts` (第191-223行，主函数)

**函数签名：**
```typescript
export const openMenu = (app: App, src: string, onlyMenu: boolean, showAccelerator: boolean) => { ... }
```

**重复情况分析：**
- 两个文件中都存在完整的 `openMenu` 函数实现
- `index.ts` 中的版本是原始实现（134行代码）
- `openMenu.ts` 中的版本是重构后的实现（33行主函数 + 多个辅助函数）
- 重构版本将逻辑拆分为：
  - `generateMobileMenuItems` - 移动端菜单项
  - `generateAssetMenuItems` - 资源文件菜单项
  - `generateAssetBaseMenuItems` - 资源文件基础菜单项
  - `generateAssetDesktopMenuItems` - 资源文件桌面端菜单项
  - `generateLocalFileMenuItems` - 本地文件菜单项
  - `generateLocalFileDesktopMenuItems` - 本地文件桌面端菜单项
  - `generateLocalFileMobileMenuItems` - 本地文件移动端菜单项
  - `generateExternalLinkMenuItems` - 外部链接菜单项
  - `generateExternalLinkDesktopMenuItems` - 外部链接桌面端菜单项
  - `generateExternalLinkMobileMenuItems` - 外部链接移动端菜单项

**代码结构对比：**

`index.ts` 版本（原始，134行）：
- 所有逻辑都在一个函数中
- 多层嵌套的 if-else 结构
- 代码可读性较差

`openMenu.ts` 版本（重构，33行主函数）：
- 逻辑清晰，按场景拆分
- 每个辅助函数职责单一
- 代码可读性和可维护性显著提升

**严重程度：高**
- 大型函数完全重复
- 重构版本明显优于原始版本
- 原始版本应该被移除

---

## 三、其他发现

### 3.1 已正确处理的导出

以下函数已经正确处理，不存在重复：

1. **copySubMenu** - `index.ts` 中通过 `export { copySubMenu } from "./copy"` 重新导出，没有重复实现
2. **openFileAttr** - `index.ts` 中通过 `import { openFileAttr } from "./openFileAttr"` 导入使用，没有重复实现

### 3.2 备份文件

- `index.ts.backup` 是备份文件，应该在重构完成后删除

---

## 四、重复情况严重程度评估

### 严重程度分级

**高危重复（3个）：**
1. `openWechatNotify` - 64行原始实现 vs 重构实现
2. `openFileWechatNotify` - 55行完全相同的实现
3. `openMenu` - 134行原始实现 vs 重构实现

**总计重复代码行数：约 253 行**

### 风险分析

1. **维护风险**：修改功能时可能只改一处，导致行为不一致
2. **代码膨胀**：重复代码增加了打包体积
3. **理解成本**：开发者可能困惑应该使用哪个版本
4. **测试覆盖**：需要对两个版本都进行测试

---

## 五、初步去重建议

### 5.1 立即行动项

1. **删除 `index.ts` 中的重复函数实现**
   - 删除 `openWechatNotify` (第47-110行)
   - 删除 `openFileWechatNotify` (第112-166行)
   - 删除 `openMenu` (第487-620行)

2. **在 `index.ts` 中添加导入和重新导出**
   ```typescript
   export { openWechatNotify } from "./commonMenuItem.openWechatNotify";
   export { openFileWechatNotify } from "./openFileWechatNotify";
   export { openMenu } from "./openMenu";
   ```

3. **删除备份文件**
   - 删除 `index.ts.backup`

### 5.2 重构优先级

**优先级1（立即处理）：**
- `openMenu` - 重构版本明显优于原始版本，应立即替换

**优先级2（尽快处理）：**
- `openWechatNotify` - 重构版本更易维护，建议替换
- `openFileWechatNotify` - 两个版本相同，任选其一删除

### 5.3 验证步骤

去重后需要验证：
1. 所有导入 `openWechatNotify` 的地方仍然正常工作
2. 所有导入 `openFileWechatNotify` 的地方仍然正常工作
3. 所有导入 `openMenu` 的地方仍然正常工作
4. 运行相关测试用例确保功能正常

### 5.4 长期改进建议

1. **建立代码审查机制**：防止未来出现类似重复
2. **使用 ESLint 规则**：检测重复代码
3. **文档化重构过程**：记录为什么某些函数被拆分到单独文件
4. **统一命名规范**：重构后的文件命名应该更清晰（如 `openWechatNotify.ts` 而不是 `commonMenuItem.openWechatNotify.ts`）

---

## 六、总结

### 发现的问题

- **3个严重重复函数**，总计约253行重复代码
- 重复函数分布在 `index.ts` 和独立的功能文件中
- 部分函数已经完成重构但未删除原始实现

### 重复原因推测

从代码结构来看，这是一个**正在进行中的重构工作**：
- 开发者将 `index.ts` 中的大型函数拆分到独立文件
- 重构后的版本质量更高（模块化、可读性好）
- 但重构未完成，原始实现未删除

### 建议行动

1. **立即删除** `index.ts` 中的3个重复函数实现
2. **添加重新导出**语句，保持API兼容性
3. **删除备份文件** `index.ts.backup`
4. **运行测试**验证功能正常
5. **提交代码**完成重构工作

### 预期收益

- 减少约253行重复代码
- 提升代码可维护性
- 降低维护风险
- 改善代码可读性
