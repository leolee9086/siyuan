# MAGI监视器独立编译入口 执行跟踪 (TikTocTak)

> **目标**: 为MAGI监视器界面创建独立编译入口，三个target（magi-app/magi-desktop/magi-mobile）对称于笔记界面。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

## 核心原则
- MAGI界面与笔记界面等同，不是工具，是工作空间的另一个用户
- 三个target结构对称于笔记界面的app/desktop/mobile
- magi-app与magi-desktop共享入口，magi-mobile独立
- `pnpm run dev` 全量编译自动包含magi
- Electron下MAGI随主窗口自动打开

## 已确认实施约定
- `magi-app` 使用 `electron-renderer`（与 `app` 对称）
- URL 路径规范固定为：
  - `/stage/build/magi-app/`
  - `/stage/build/magi-desktop/`
  - `/stage/build/magi-mobile/`
- HTML 模板采用最小壳结构（仅承载 MAGI 根节点）
- MAGI 入口按桌面端/移动端分离：桌面共享入口、移动独立入口
- Electron 侧使用专用 IPC：`siyuan-open-magi`
- MAGI 窗口每个工作空间仅一个实例
- MAGI 窗口关闭按钮行为为 `hide`，不直接销毁
- MAGI 窗口生命周期与主笔记窗口一致
- MAGI 维护独立 `window.siyuan`，为后续可能接入 `protyle` 预留
- 接受 `pnpm run dev` 全量编译时长上升

### 验证检查清单
- [x] `pnpm run dev:magi-app` 编译通过
- [x] `pnpm run dev` 全量编译通过
- [x] `stage/build/magi-app/index.html` 正常生成
- [x] `stage/build/magi-desktop/index.html` 正常生成
- [x] `stage/build/magi-mobile/index.html` 正常生成
- [ ] 浏览器访问 magi-desktop 能看到MAGI界面
- [ ] Electron 主界面状态栏按钮可唤起 MAGI 窗口
- [ ] MAGI 窗口关闭按钮触发 `hide`，可再次唤起
- [ ] MAGI 界面显示 CONSOLE 按钮，点击可打开 DevTools（Electron）
- [ ] AI 配置缺失或错误时，MAGI 前端显示具体失败原因（非泛化“连接失败”）
- [ ] 后端返回有效 AI 配置时，MAGI 可正常建立连接

## 🟢 近期计划

- [x] **Phase 1: 编译配置 (P0)**
  - **背景**: 所有后续工作都依赖编译基础设施
  - **行动**:
    1. `build.targets.json` 新增 magi-app/magi-desktop/magi-mobile
    2. `package.json` 新增 dev/build 脚本
  - **验收标准**: webpack 能识别新target，`--env target=magi-app` 不报未知target错误

- [x] **Phase 2: HTML模板 + 入口文件 (P0)**
  - **背景**: 编译需要有效的入口和模板
  - **行动**:
    1. 创建3个HTML模板（magi-app/magi-desktop/magi-mobile）
    2. 创建 `entry/index.ts`（桌面端共享入口）
    3. 创建 `entry/mobile.ts`（移动端入口）
    4. 创建 `entry/MagiRoot.vue`（顶层Vue组件）
  - **验收标准**: 编译通过，生成有效HTML，浏览器能加载

- [ ] **Phase 4: 联调验证与收尾 (P1)**
  - **背景**: 代码改造已完成，当前重点是按用户路径验证可用性并收敛遗留风险
  - **行动**:
    1. Electron 下验证状态栏按钮唤起、关闭即隐藏、重复唤起稳定性
    2. 验证 MAGI 白屏不再出现（启动、切换、重开场景）
    3. 验证 AI 配置从后端读取链路与错误文案透传
    4. 整理最终验收记录并关闭该 ttt
  - **验收标准**: 验证检查清单全部勾选，且无阻断级问题

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

## 🏁 已归档/已完成

- [x] **2026-03-02** Phase 1: 编译配置 (P0)
  - `build.targets.json` 已新增 `magi-app/magi-desktop/magi-mobile`
  - `package.json` 已新增 `dev/build` 的 `magi-*` 脚本
  - `webpack --env target=magi-app` 已通过配置级校验

- [x] **2026-03-02** Phase 2: HTML模板 + 入口文件 (P0)
  - 已创建模板：
    - `src/assets/template/magi/app/index.tpl`
    - `src/assets/template/magi/desktop/index.tpl`
    - `src/assets/template/magi/mobile/index.tpl`
  - 已创建入口：
    - `src/magi/entry/index.ts`（桌面共享）
    - `src/magi/entry/mobile.ts`（移动独立）
    - `src/magi/entry/MagiRoot.vue`
  - 已补充入口配套文件：
    - `src/magi/entry/MagiRoot.ctx.ts`
    - `src/magi/entry/MagiRoot.types.ts`
    - `src/magi/entry/MagiRoot.css`
    - `src/magi/entry/magiEntry.environment.ts`
    - `src/magi/entry/magiEntry.types.ts`

- [x] **2026-03-02** 构建验证
  - `webpack --mode development --env target=magi-app --no-watch` 通过
  - `webpack --mode development --env target=magi-desktop --no-watch` 通过
  - `webpack --mode development --env target=magi-mobile --no-watch` 通过
  - `webpack --mode development --no-watch` 全 target 编译通过（含 `magi-*`）
  - 产物存在：
    - `stage/build/magi-app/index.html`
    - `stage/build/magi-desktop/index.html`
    - `stage/build/magi-mobile/index.html`

- [x] **2026-03-02** Phase 3: Electron适配 (P1)
  - `main.js` 已完成 `magi` URL 白名单放行
  - 主窗口 `ready-to-show` 后自动创建并展示 MAGI 窗口
  - 新增专用 IPC：`siyuan-open-magi`
  - MAGI 窗口按工作空间单实例管理
  - MAGI 窗口关闭行为改为 `hide`（不销毁）

- [x] **2026-03-02** 主界面唤起入口与可观测性增强
  - 已新增主界面状态栏 `MAGI` 按钮并接入窗口唤起逻辑
  - 已新增 MAGI 界面 `CONSOLE` 按钮（Electron 下可打开 DevTools）
  - 视觉样式已按现有界面风格做一致性适配

- [x] **2026-03-02** 稳定性修复：Magi 空白页问题
  - 顶层入口初始化从阻塞式改为同步挂载 + 异步 bootstrap
  - 补充 bootstrap 异常捕获，避免首屏因初始化异常进入空白态

- [x] **2026-03-02** 连接配置与错误可诊断性修复
  - 移除占位符 `https://api.your-ai-service.com/v1/chat/completions` 相关默认值依赖
  - MAGI 启动阶段补充后端配置拉取（`/api/system/getConf`）并合并到运行配置
  - 连接失败时前端展示具体错误来源（HTTP 状态码/接口地址/后端错误消息）
