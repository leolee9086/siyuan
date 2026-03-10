# Dummysys - 傀儡系统

## 概述

Dummysys（Dummy System，傀儡系统）是MAGI架构中的Avatar运行时管理框架。其命名源自"傀儡"的本质特征：**空壳载体需要外部力量驱动才能行动**。

在MAGI架构中，Avatar本质上是**提示词框架和人格定义的容器**，本身不具备执行能力。它必须"着甲"（attach）到实际的agent平台（如Claude Code、Cursor等），借用宿主环境的工具能力才能完成任务。

## 核心概念

### 傀儡（Avatar）的三层结构

```
┌─────────────────────────────────────┐
│   MAGI Core (三贤者协调层)           │
│   - Melchior, Balthazar, Casper     │
└──────────────┬──────────────────────┘
               │ 元层通信
               │ (report_to_core, heartbeat)
┌──────────────▼──────────────────────┐
│   Dummysys (傀儡管理层)              │
│   - AvatarDescriptor: 人格容器       │
│   - ATFBaselineAvatar: 裸LLM基线     │
│   - 生命周期管理                     │
│   - 上下文维护                       │
└──────────────┬──────────────────────┘
               │ 着甲（Attach）
               │
┌──────────────▼──────────────────────┐
│   Agent Platform (执行层)            │
│   - Claude Code / Cursor / ...      │
│   - 文件操作、命令执行等工具         │
│   - 实际的行动能力                   │
└─────────────────────────────────────┘
```

### 关键特性

1. **人格与能力分离**
   - Avatar仅定义人格、角色、系统提示词
   - 实际工具能力由宿主agent平台提供
   - 同一Avatar可着甲到不同平台

2. **轻量级运行时**
   - 不实现复杂的工具调用逻辑
   - 专注于对话管理和状态维护
   - 最小化资源占用

3. **元层通信机制**
   - 通过`report_to_core`与MAGI主体通信
   - 心跳监控确保Avatar存活
   - 支持状态汇报和协调请求

## 主要组件

### 1. AvatarDescriptor

Avatar的核心运行时实体，管理单个Avatar的完整生命周期。

**状态机：**
- `idle` - 空闲状态，等待任务
- `active` - 活跃状态，正在处理消息
- `destroyed` - 已销毁，不可恢复

**核心功能：**
- 维护对话上下文（context）
- 处理用户消息并调用LLM
- 心跳超时检测
- 状态转换管理

**配置项：**
```go
type AvatarConfig struct {
    AvatarRoleID            string        // Avatar角色ID
    AvatarNumber            int           // Avatar编号
    Channel                 AvatarChannel // 通道类型
    SystemPrompt            string        // 系统提示词
    ExposureMode            ExposureMode  // 暴露模式
    HeartbeatIntervalRounds int           // 心跳间隔轮数
}
```

### 2. ATFBaselineAvatar

**裸LLM基线Avatar**，用于ATF（Avatar-Trinity Fitness）同步率测试。

**设计目的：**
- 不包含任何MAGI架构组件
- 使用极简系统提示词
- 作为性能对比基准
- 衡量完整MAGI架构的增益

**使用场景：**
- 问卷测试
- 同步率计算
- 性能基线建立

## 通道类型

Dummysys支持多种Avatar通道，对应不同的使用场景：

| 通道类型 | 说明 | 典型用途 |
|---------|------|---------|
| `guardian` | 守护者通道 | 长期运行的监控任务 |
| `external-agent` | 外部代理通道 | 与外部系统集成 |
| `system-cron` | 系统定时任务 | 周期性自动化任务 |
| `unknown` | 未知通道 | 默认/测试用途 |

## 暴露模式

控制Avatar对MAGI记忆系统的访问权限：

- `full` - 完全暴露，可访问所有记忆
- `partial` - 部分暴露，受限访问
- `distorted` - 扭曲暴露，经过过滤的记忆

## 心跳机制

Avatar必须定期通过`report_to_core(type="heartbeat")`向MAGI主体报告存活状态。

**工作流程：**
1. Avatar每处理一轮消息，`roundsSinceMetaReport`计数器+1
2. 当计数器达到`HeartbeatIntervalRounds`时触发超时
3. Avatar需调用心跳工具重置计数器
4. 超时未心跳可能导致Avatar被标记为异常

**示例工具调用：**
```json
{
  "type": "heartbeat",
  "content": "still alive",
  "urgency": "low"
}
```

## 使用示例

### 创建标准Avatar

```go
import (
    "github.com/siyuan-note/siyuan/kernel/nerv/dummysys"
    "github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
)

// 配置Avatar
config := dummysys.AvatarConfig{
    AvatarRoleID:            "avatar-melchior-01",
    AvatarNumber:            1,
    Channel:                 dummysys.AvatarChannelGuardian,
    SystemPrompt:            "",
    ExposureMode:            dummysys.ExposureModeFull,
    HeartbeatIntervalRounds: 5,
}

// 创建Avatar实例
llmClient := llm.NewClient(...)
avatar, err := dummysys.NewAvatar(config, llmClient)
if err != nil {
    // 处理错误
}

// 处理消息
ctx := context.Background()
result, err := avatar.ProcessMessage(ctx, "分析当前任务状态")
```

### 创建ATF基线Avatar

傀儡系统存在一个使用与MAGI使用完全一样人格档案的特殊傀儡,专用于计算MAGI的同步率和ATF值,以校验MAGI跟裸LLM的差别.

## 与MAGI架构的关系

Dummysys是MAGI架构的**执行层基础设施**：

1. **MAGI Core** - 三贤者协调决策
2. **Coordinator** - 任务分发和结果聚合
3. **Dummysys** - Avatar运行时管理
4. **Agent Platform** - 实际执行环境

Avatar通过`report_to_core`工具向上层汇报：
- 任务进度
- 异常情况
- 心跳信号
- 协调请求

## 设计哲学

### 为什么叫"傀儡系统"？

1. **空壳特性** - Avatar本身是空的，只有人格定义
2. **依赖宿主** - 必须着甲到agent平台才能行动
3. **可替换性** - 同一人格可以在不同平台间迁移
4. **控制分离** - 意识（MAGI）与身体（agent）分离

### 与EVA的类比

类似《新世纪福音战士》中的Dummy Plug（傀儡插件）：
- EVA机体 = Agent平台（提供能力）
- Dummy Plug = Avatar（提供人格）
- 插入过程 = 着甲过程
- MAGI系统 = 决策中枢

## 测试

运行单元测试：
```bash
cd kernel/nerv/dummysys
go test -v
```

测试覆盖：
- Avatar创建和配置验证
- 状态转换逻辑
- 心跳超时检测
- 上下文管理
- ATF基线Avatar功能

## 未来扩展

- [ ] 支持Avatar快照和恢复
- [ ] 多平台着甲适配器
- [ ] 上下文压缩和归档
- [ ] Avatar性能监控指标
- [ ] 分布式Avatar调度

## 参考

- [MAGI架构文档](../magi/README.md)
- [Coordinator协调器](../magi/coordinator/README.md)
- [ATF测试框架](../seraph/README.md)
