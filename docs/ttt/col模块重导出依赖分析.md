# col.ts 重导出依赖关系调查

调查时间: 2026-02-25

## 一、col.ts 当前结构（共407行）

| 行范围 | 导出名 | 类型 |
|--------|--------|------|
| 21 | `getColNameByType`, `getColIconByType` | 重导出 ← col.typeUtils |
| 23-29 | `getColId` | 原生函数（7行） |
| 31 | `duplicateCol` | 重导出 ← col.operations |
| 33-122 | `getEditHTML` | 原生函数（90行） |
| 124-169 | `bindEditEvent` | 原生函数（46行） |
| 172-401 | `showColMenu` | 原生函数（230行） |
| 403 | `removeCol` | 重导出 ← col.operations |
| 405 | `addCol` | 重导出 ← col.addCol |
| 406 | `genColDataByType` | 重导出 ← col.typeUtils |

5条重导出语句：L21, L31, L403, L405, L406

## 二、外部调用者分析

"外部"指 col.* 家族之外的文件。

### getColIconByType（14个外部调用者，全部从 `./col` 或 `../col` 导入）

| 文件 | 导入语句 |
|------|----------|
| filter.render.ts | `import {getColIconByType} from "./col"` |
| groups.ts | `import {getColIconByType} from "./col"` |
| rollup.ts | `import {getColIconByType, getColId} from "./col"` |
| sort.ts | `import {getColIconByType} from "./col"` |
| render.table.ts | `import {getColIconByType} from "./col"` |
| openMenuPanel.properties.ts | `import { getColIconByType } from "./col"` |
| openMenuPanel.click.colEdit.ts | `import { bindEditEvent, getColIconByType, getColNameByType, getEditHTML } from "./col"` |
| filter.ts | `import {getColIconByType} from "./col"` |
| cell.position.ts | `import {getColIconByType} from "./col"` |
| action.ts | `import {addCol, getColIconByType, showColMenu} from "./col"` |
| blockAttr.ts | `import {addCol, getColIconByType} from "./col"` |
| kanban/render.ts | `import {getColIconByType, getColNameByType} from "../col"` |
| gallery/render.ts | `import {getColIconByType, getColNameByType} from "../col"` |
| gallery/util.ts | `import {getColIconByType} from "../col"` |

### getColNameByType（3个外部调用者）

| 文件 | 导入语句 |
|------|----------|
| openMenuPanel.click.colEdit.ts | `import { bindEditEvent, getColIconByType, getColNameByType, getEditHTML } from "./col"` |
| kanban/render.ts | `import {getColIconByType, getColNameByType} from "../col"` |
| gallery/render.ts | `import {getColIconByType, getColNameByType} from "../col"` |

### genColDataByType（0个外部调用者）

仅被 col.addAttrViewColAnimation.ts（家族内部）通过 `./col` 导入。

### duplicateCol（1个外部调用者）

| 文件 | 导入语句 |
|------|----------|
| openMenuPanel.click.colOps.ts | `import { addCol, duplicateCol, removeCol, bindEditEvent, getEditHTML } from "./col"` |

注：col.showColMenu.items.ts 和 col.showColMenu.actions.ts 已直接从 `./col.operations` 导入。

### removeCol（1个外部调用者）

| 文件 | 导入语句 |
|------|----------|
| openMenuPanel.click.colOps.ts | `import { addCol, duplicateCol, removeCol, bindEditEvent, getEditHTML } from "./col"` |

### addCol（3个外部调用者）

| 文件 | 导入语句 |
|------|----------|
| action.ts | `import {addCol, getColIconByType, showColMenu} from "./col"` |
| blockAttr.ts | `import {addCol, getColIconByType} from "./col"` |
| openMenuPanel.click.colOps.ts | `import { addCol, duplicateCol, removeCol, bindEditEvent, getEditHTML } from "./col"` |

## 三、col.* 家族内部依赖关系

### 从 col.ts 导入的家族文件

| 家族文件 | 从 col.ts 导入的符号 |
|----------|---------------------|
| col.addAttrViewColAnimation.ts | `getColIconByType, getColNameByType, getEditHTML, bindEditEvent, genColDataByType` |

### 家族文件间互相导入

| 源文件 | 目标文件 | 导入符号 |
|--------|----------|----------|
| col.editPanel.ts | col.typeUtils | `getColIconByType, getColNameByType` |
| col.editPanel.bind.ts | col.editPanel.bind.types | `IBindEditContext` |
| col.editPanel.bind.relation.ts | col.editPanel.bind.types | `IBindEditContext` |
| col.showColMenu.ts | col.typeUtils | `getColIconByType` |
| col.showColMenu.ts | col.removeColByMenu | `removeColByMenu` |
| col.showColMenu.ts | col.showColMenu.types | `IShowColMenuContext` |
| col.showColMenu.items.ts | col.showColMenu | `handleFilterClick, handleSortClick, handleDeleteColClick` |
| col.showColMenu.items.ts | col.addCol | `addCol` |
| col.showColMenu.items.ts | col.operations | `duplicateCol` |
| col.showColMenu.items.ts | col.showColMenu.types | `IShowColMenuContext` |
| col.showColMenu.actions.ts | col.showColMenu | `handleFilterClick, handleSortClick, handleDeleteColClick` |
| col.showColMenu.actions.ts | col.addCol | `addCol` |
| col.showColMenu.actions.ts | col.operations | `duplicateCol` |
| col.showColMenu.actions.ts | col.showColMenu.types | `IShowColMenuContext` |
| col.addCol.ts | col.addAttrViewColAnimation | `addAttrViewColAnimation` |
| col.addCol.ts | col.addCol.types | `IAddColContext` |
| col.operations.ts | col.addAttrViewColAnimation | `addAttrViewColAnimation` |

### ⚠️ 循环依赖风险

```
col.ts
  → imports col.showColMenu.items (buildMenuCloseCallback)
    → imports col.addCol (addCol)
      → imports col.addAttrViewColAnimation (addAttrViewColAnimation)
        → imports col.ts (getEditHTML, bindEditEvent, genColDataByType, getColIconByType, getColNameByType)
```

```
col.ts
  → imports col.showColMenu.items (buildMenuCloseCallback)
    → imports col.operations (duplicateCol)
      → imports col.addAttrViewColAnimation (addAttrViewColAnimation)
        → imports col.ts (getEditHTML, bindEditEvent, genColDataByType, getColIconByType, getColNameByType)
```

col.addAttrViewColAnimation.ts 是循环的关键节点——它从 col.ts 导入了5个符号，其中 `getEditHTML` 和 `bindEditEvent` 是 col.ts 的原生函数，无法简单改为从其他模块导入。

## 四、消除重导出的影响评估

### 低影响：genColDataByType
- 仅1个调用者（col.addAttrViewColAnimation.ts，家族内部）
- 改为直接从 `./col.typeUtils` 导入即可

### 低影响：duplicateCol + removeCol
- 仅1个外部调用者（openMenuPanel.click.colOps.ts）
- 改为直接从 `./col.operations` 导入即可

### 中等影响：addCol
- 3个外部调用者需要改导入路径
- 改为从 `./col.addCol` 导入

### 高影响：getColIconByType + getColNameByType
- 14+3=17个外部调用者需要改导入路径
- 改为从 `./col.typeUtils` 导入
- 子目录文件（kanban/render.ts, gallery/render.ts, gallery/util.ts）路径需改为 `../col.typeUtils`
