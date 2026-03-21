# Clock Gutter Demo Widget

这个目录是一个可直接运行的挂件示例，用于验证以下能力：

1. `NodeIFrame` / `NodeWidget` gutter 菜单里的“在浏览器中查看”与“在新页签中打开”
2. `NodeWidget` 打开链接时自动追加挂件块 `id`
3. 挂件通过事件机制向自己的 gutter 菜单追加菜单项

## 目录结构

- `widget.json`：挂件元数据（挂件可搜索、可插入的关键）
- `index.html`：挂件入口页
- `main.js`：时钟逻辑 + gutter 菜单事件扩展逻辑
- `styles.css`：挂件样式
- `install-to-dev-workspace.ps1`：复制到 `.dev-workspace/data/widgets` 的安装脚本

## 安装到开发工作空间

在仓库根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\packages\widget-clock-gutter-demo\install-to-dev-workspace.ps1
```

安装后目录会是：

```text
.dev-workspace/data/widgets/clock-gutter-demo
```

## 测试步骤

1. 启动思源并使用 `.dev-workspace` 工作空间
2. 在文档中输入 `/挂件`，选择 `Clock Gutter Demo`
3. 打开该挂件块 gutter 菜单：
   - 能看到“在浏览器中查看”和“在新页签中打开”
   - 挂件 URL 带有 `?id=<block-id>`
   - 菜单末尾出现挂件注入的自定义项（如“复制当前时间”）
4. 用浏览器直接访问 `/widgets/clock-gutter-demo/?id=<block-id>`，确认独立模式正常

## 挂件菜单事件协议

事件名：`siyuan-widget-block-gutter-menu`

挂件内监听示例：

```js
window.addEventListener("siyuan-widget-block-gutter-menu", (event) => {
  const detail = event.detail;
  if (!detail || typeof detail.append !== "function") return;
  detail.append({
    id: "myWidgetItem",
    label: "自定义菜单",
    click: () => {
      console.log("clicked");
    }
  });
});
```

`detail` 关键字段：

- `widgetId`: 当前挂件块 ID
- `iframeSrc`: 当前挂件 iframe 原始 src
- `browserURL`: 已附加 `id` 参数后的可打开 URL
- `append(menuItem)`: 注入菜单项
