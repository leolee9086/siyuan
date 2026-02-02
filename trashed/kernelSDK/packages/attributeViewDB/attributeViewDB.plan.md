## 📏 TikTokTac 管理规则

### 🔄 滚动规则
- **文档长度限制**: 最大200行，建议150行内
- **已完成循环**: 最多保留3个，其余移至 `archive/completed-cycles.md`
- **问题池**: 每类最多保留10个，解决的问题移至归档
- **技术债务**: 已清理项目移至归档，保持当前视图简洁

### 📋 滚动触发条件
**必须滚动** (任一条件满足):
- 文档行数 > 200行
- 已完成循环 > 3个
- 问题池单类 > 10个

**滚动操作**:
1. 已完成循环 → `archive/completed-cycles-[YYYY-MM].md`
2. 解决的问题 → `archive/solved-issues-[YYYY-MM].md`  
3. 清理的技术债务 → `archive/tech-debt-cleared-[YYYY-MM].md`
4. 在本文档末尾记录归档时间和位置

### ⏰ 维护周期
- **每日**: 更新当前Tik状态
- **每周**: 检查行数，必要时执行滚动
- **每月**: 整理归档，清理无效链接

---

## 🔄 当前循环状态

### 🔥 **Tik** ([状态]: 执行中🔧) 
**任务**: 完善 `attributeViewDB` 模块
**问题**: 当前模块仅有 `getAllAttributeViews`，功能不完整，缺乏完整的CRUD操作和相应的测试。
**核心目标**:
- [ ] **目标1**: 实现属性视图的完整 CRUD (Create, Read, Update, Delete) 功能。
- [ ] **目标2**: 为所有 CRUD 操作编写全面的单元测试。
- [ ] **目标3**: 遵循项目代码规范，确保代码质量和可维护性。

### ⏳ **Tok** (待定执行)
**任务**: 实现 `attributeViewDB` 的 CRUD 功能
**执行状态**: [⚪待定]

**📋 详细执行计划**:
- **阶段1**: **Read 操作增强** (预计 1h) [✅已完成]
  - [x] 分析思源内核 `router.go`，确定 `getAttributeView` (获取单个) 的 API 接口定义。
  - [x] 在 `packages/attributeViewDB/index.js` 中实现 `getAttributeView(avID)` 函数。
  - [x] 在 `packages/attributeViewDB/test/attributeViewDB.test.js` 中为 `getAttributeView` 添加测试用例。

- **阶段2**: **Create 操作实现** (预计 1.5h) [🔧执行中]
  - [x] 分析 `router.go`，确定 `createAttributeView` 的 API 接口定义和参数。
  - [ ] 在 `index.js` 中实现 `createAttributeView(notebookID, blockID, name)` 函数。
  - [ ] 添加相应的测试用例，验证视图创建和数据返回的正确性。

- **阶段3**: **Update 操作实现** (预计 1h) [⚪待定]
  - [ ] 分析 `router.go`，确定 `updateAttributeView` 的 API 接口定义。
  - [ ] 在 `index.js` 中实现 `updateAttributeView(avID, name)` 函数。
  - [ ] 添加测试用例，验证更新操作。

- **阶段4**: **Delete 操作实现** (预计 1h) [⚪待定]
  - [ ] 分析 `router.go`，确定 `deleteAttributeView` 的 API 接口定义。
  - [ ] 在 `index.js` 中实现 `deleteAttributeView(avID)` 函数。
  - [ ] 添加测试用例，验证删除操作。

### 📋 **Tak** (待定修正)
- [ ] 代码审查和重构。
- [ ] 优化函数命名和参数，使其更符合规范。
- [ ] 完善 AInote.md 和相关文档。

---

## 📋 问题池

### 🔴 高优先级 (当前: 1/10)
- [ ] **[功能缺失]**: `attributeViewDB` 模块核心 CRUD 功能缺失。→ (当前循环正在解决)

---

## 🔌 接口作用与设计清单

| 操作 | 目的 | 预期 Kernel API 路径(待确认) | JS 封装函数 | 关键参数 | 返回字段 | 备注 |
| ---- | ---- | --------------------------- | ------------ | -------- | -------- | ---- |
| List | 列出当前工作空间/笔记本的全部属性视图 | /av/list 或 /attribute-view/list | getAllAttributeViews() | notebookID?(可选) | results[] | 已实现，需补充 notebookID 过滤 |
| Read | 获取单个属性视图详细信息 | /av/get | getAttributeView(avID) | avID | avID, avName, blockID, hPath, attrList[] | attrList 列出每个属性配置 |
| Create | 新建属性视图 | /av/create | createAttributeView(notebookID, blockID, name) | notebookID, blockID, name | avID | 返回新建 ID，便于链式调用 |
| Update | 更新属性视图名称/配置 | /av/update | updateAttributeView(avID, payload) | avID, payload{ name?, config? } | success(bool) | 支持局部更新 |
| Delete | 删除属性视图 | /av/delete | deleteAttributeView(avID) | avID | success(bool) | 需谨慎，最好二次确认 |

> ⚠️ 路径以 `router.go` 中实际定义为准，上表仅示意。

---

### 🔌 属性项（字段）CRUD 设计清单

| 操作 | 目的 | 预期 Kernel API 路径(待确认) | JS 封装函数 | 关键参数 | 返回字段 | 备注 |
| ---- | ---- | --------------------------- | ------------ | -------- | -------- | ---- |
| ListItems | 获取某视图下全部属性字段 | /av/item/list | getAttributeItems(avID) | avID | items[] | items 包含 itemID、name、type、formula 等 |
| ReadItem | 获取单个字段详情 | /av/item/get | getAttributeItem(avID, itemID) | avID, itemID | itemID, name, type, config | |
| CreateItem | 新增字段 | /av/item/create | createAttributeItem(avID, payload) | avID, payload{name, type, config} | itemID | 支持不同类型字段 |
| UpdateItem | 更新字段配置 | /av/item/update | updateAttributeItem(avID, itemID, payload) | avID, itemID, payload | success(bool) | 如修改公式、名称等 |
| DeleteItem | 删除字段 | /av/item/delete | deleteAttributeItem(avID, itemID) | avID, itemID | success(bool) | 删除后视图列减少 |

---

### 📋 Tok 阶段任务拆解（细化）

#### Tok-1 Read 功能增强
- [ ] grep `router.go` 中与 `attribute-view`/`av` 相关的路由条目；确认单条查询接口路径与返回结构。
- [ ] 在 `index.js` 实现 `getAttributeView(avID)`：
  - [ ] 调用 kernel api
  - [ ] 数据校验与错误处理
- [ ] 编写测试：
  - [ ] 有效 avID 正确返回数据
  - [ ] 无效/不存在 avID 返回合理错误

#### Tok-2 Create 功能
- [ ] 确认创建路由及必需字段
- [ ] 实现 `createAttributeView(notebookID, blockID, name)`：
  - [ ] 参数校验（空字符串、非法 ID）
  - [ ] 成功后返回 avID
- [ ] 测试用例：
  - [ ] 正常创建
  - [ ] 重名或非法参数报错

#### Tok-3 Update 功能
- [ ] 路由分析，支持批量/局部更新
- [ ] 实现 `updateAttributeView(avID, payload)`：
  - [ ] 支持更新名称、配置
- [ ] 测试用例：
  - [ ] 修改名称
  - [ ] 提交空 payload 不做变更

#### Tok-4 Delete 功能
- [ ] 确认删除路由
- [ ] 实现 `deleteAttributeView(avID)`
- [ ] 测试用例：
  - [ ] 删除存在的视图
  - [ ] 删除不存在的视图返回错误

#### Tok-5 代码质量与文档
- [ ] 代码自查：命名、注释、纯函数约束
- [ ] 完善 `AInote.md`：记录接口分析与设计决策
- [ ] 更新 `README.md` 或模块说明

#### Tok-6 属性项 CRUD 功能（新增）
- [ ] 路由确认：`/av/item/*` 相关五个端点（list/get/create/update/delete）。
- [ ] 实现 `getAttributeItems(avID)`
- [ ] 实现 `getAttributeItem(avID, itemID)`
- [ ] 实现 `createAttributeItem(avID, payload)`
- [ ] 实现 `updateAttributeItem(avID, itemID, payload)`
- [ ] 实现 `deleteAttributeItem(avID, itemID)`
- [ ] 单元测试：
  - [ ] 新增字段后 `ListItems` 应包含新列
  - [ ] 更新字段后读取应反映最新配置
  - [ ] 删除字段后数量减少且读取单项报错

---

> 若在 Tok 执行过程中发现额外接口需求（如排序、复制属性视图），需在计划中追加并循环。

---