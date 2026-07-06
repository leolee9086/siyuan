## 功能:

<p align="center">
<b>English</b>
| <a href="README.zh-CN.md">中文</a>
| <a href="README.ja.md">日本語</a>
| <a href="README.tr.md">Türkçe</a>
</p>

本仓库是我个人fork用于适应个人使用场景的仓库,所以代码有大量修改.

## 为什么不pr到原始仓库?

因为我做出的一些修改为了能够快速适配我自己的需求所以并没有考虑适配原始仓库.

而且我并不是专业程序员也确实没有能力善用git参与大型项目的协作,有些时候如果有一些思路因为本身代码已经修改过多可能也无法跟官方版本的代码兼容,所以pr可能反而带来困扰.

这确实并不是好的实践,但是个人能力和实际情况只能做到这样.

## 非兼容性?
### 部分UI组件迁移到了vue实现

### 界面I18n获取方式有一定差异
### typescript配置使用严格模式

### 功能更新和bug修复**不会**及时跟进官方代码仓库,所以可能会有一些功能缺失和官方版本中并不存在的bug

### 修改过的部分可能使用中文变量名等跟正规编码习惯不兼容的做法
### 添加了一些可能比较冗长的注释(避免我自己看不懂代码)

### 为了快速实现功能,包含大量AI编码

## sforge分支特有模式: forge(工坊模式)

`forge` 是这个 `sforge` 分支新增的运行模式,不属于上游官方分支。如果你基于官方 `siyuan-note/siyuan` 文档操作,请注意官方分支默认没有该模式。
### 设计目标

- 在源码目录内直接使用工作空间(默认约定 `.dev-workspace`)
- 支持多个 clone 并行开发时互不干扰
- 尽量复用 `dev` 行为,但将分支特有逻辑隔离在 `forge` 模式

### 和 dev 模式的关系
- `forge` 与 `dev` 在资源加载等开发行为上基本一致- 以 `forge` 放宽以下限制:
  - 允许工作空间位于开发目录内
  - 允许以 `.` 开头的目录名(例如 `.dev-workspace`)

### 启动示例

在 `kernel/` 目录下运行:

```bash
go run . serve --workspace=../.dev-workspace --mode forge --wd=../app
```

> 注意: 如果直接从 `go run` 启动内核,`--wd` 需要指向 `app` 目录。上游 3.7.0 起服务端启动需要显式传入 `serve` 子命令。
Electron 开发环境下,本分支也会以 `--mode forge` 启动内核。
### 语言参数

`SIYUAN_LANG` 和 `--lang` 使用 BCP 47 语言标签,例如 `zh-CN`、`zh-TW`、`en`、`ja`、`pt-BR`。旧的下划线格式(如 `zh_CN`、`en_US`)仍保留兼容。
## 可能有用的部分?
因为个人习惯和适应AI编程,所以会把很多其它包放到这个仓库一起联动修改:
/kernelSDK是一个土法作业的思源核心API客户端
/pacakges/dehaze是一个基于webgpu的图片暗通道去雾算法库
### 命令行工具
内置 CLI 可以直接访问工作空间数据,无需先启动服务端。常用示例:

```bash
siyuan notebook list -w ~/SiYuan
siyuan search "keyword" -w ~/SiYuan -f json
siyuan export md --id <block-id> -w ~/SiYuan
```

运行 `siyuan --help` 可以查看完整命令树,脚本场景可用 `-f json` 输出结构化结果。
### 插件|挂件|模板|主题

为了便于AI直接读取源代码快速开发插件,我将我自己的插件仓库也全部合并到了这个仓库中,如果以后有更好的组织方式也可能拆到:
至于不使用monorepo则是因为我觉得直接使用pnpm link更加简单明确和低耦合.

位于extensions中的对应目录,它们全部都是我自己使用的一些小功能,也许对你有用,也许没有.

## 不要对这个仓库发起pr

虽然知道应该不会有,但是还是先说一声,因为我个人经济困难,所以并不会有时间和能力处理代码合并

而且这个是一个自用修改版,给思源的官方仓库贡献代码能够帮到所有人

如果你确实有什么好主意想要分享给我的话,可能需要做好pr也长时间不会得到处理的心理准备.

## issue可能长时间得不到回复

因为我个人经济状况说不上特别好,平时为了生活焦头烂额,所以也没有时间查看Issue,但是有时间的时候我就会去处理.

## 依赖替换

### Lute (Markdown 引擎)

使用 fork [leolee9086/lute](https://github.com/leolee9086/lute) 替换上游 [88250/lute](https://github.com/88250/lute)，修改见 `kernel/go.mod`：
```
replace github.com/88250/lute => github.com/leolee9086/lute v0.0.0-20260429173809-0837d6611351
```

改动：`parseBlockRefID` 支持 `((id1 id2 id3 "text"))` 多 ID 块引用语法。
### fork 源码位置

```
D:\dev\lute
```

## 协议

所有代码遵守GPL-3.0-or-later

希望我没有拼写错误!
