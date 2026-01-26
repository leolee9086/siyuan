# 性能优化工程规范指南

> **SOTA 级别的性能优化工程规范**  
> 版本：1.0.0  
> 最后更新：2026-01-26

## 目录

- [1. 概述](#1-概述)
- [2. 优化前的准备工作](#2-优化前的准备工作)
- [3. 功能等价性验证](#3-功能等价性验证)
- [4. 性能验证规范](#4-性能验证规范)
- [5. 代码质量标准](#5-代码质量标准)
- [6. 文档要求](#6-文档要求)
- [7. 回滚和应急方案](#7-回滚和应急方案)
- [8. 最佳实践和案例](#8-最佳实践和案例)

---

## 1. 概述

### 1.1 目标

本指南旨在建立一套严格的性能优化工程规范，确保：

- ✅ **功能正确性**：优化后的代码与原始实现功能完全等价
- ✅ **性能提升**：通过科学的基准测试验证性能改进
- ✅ **代码质量**：保持或提升代码的可读性和可维护性
- ✅ **风险控制**：建立完善的回滚机制和应急方案
- ✅ **知识沉淀**：完整记录优化过程和技术决策

### 1.2 适用范围

本规范适用于所有生产环境级别的性能优化工作，包括但不限于：

- 算法优化
- 数据结构改进
- 并发性能提升
- 内存使用优化
- I/O 性能改进

### 1.3 核心原则

1. **安全第一**：功能正确性优先于性能提升
2. **科学验证**：使用统计学方法验证性能改进
3. **可追溯性**：完整记录优化过程和决策依据
4. **可回滚性**：始终保持回滚到原始实现的能力

---

## 2. 优化前的准备工作

### 2.1 代码备份策略

#### 2.1.1 使用 Git 分支（推荐）

```bash
# 创建备份分支
git checkout -b backup/optimization-phase-N-original

# 提交当前状态
git add .
git commit -m "backup: 保存 Phase N 优化前的原始实现"

# 推送到远程（可选但推荐）
git push origin backup/optimization-phase-N-original

# 切回主分支继续工作
git checkout main
```

**优点**：
- 完整的版本历史
- 易于对比和回滚
- 支持团队协作

#### 2.1.2 创建文件副本

```bash
# 为关键文件创建 .original 备份
cp kernel/av/filter.go kernel/av/filter.go.original

# 添加时间戳（可选）
cp kernel/av/filter.go kernel/av/filter.go.original.$(date +%Y%m%d_%H%M%S)
```

**适用场景**：
- 单文件优化
- 快速本地测试
- 不便使用 Git 的情况

#### 2.1.3 备份检查清单

- [ ] 已创建 Git 备份分支或文件副本
- [ ] 备份包含所有相关文件（源码、测试、配置）
- [ ] 备份已验证可以正常编译和运行
- [ ] 备份位置已记录在优化文档中

### 2.2 建立基准测试套件

#### 2.2.1 基准测试设计原则

1. **覆盖典型场景**：测试应覆盖实际使用中的常见情况
2. **包含边界条件**：测试极端情况（空数据、大数据、特殊值）
3. **可重复性**：测试结果应该稳定可重复
4. **隔离性**：每个测试应该独立，不受其他测试影响

#### 2.2.2 Go 语言基准测试示例

```go
// filter_benchmark_test.go
package av

import (
    "testing"
)

// BenchmarkFilterRows_SmallDataset 测试小数据集性能
func BenchmarkFilterRows_SmallDataset(b *testing.B) {
    // 准备测试数据
    rows := generateTestRows(100)
    filter := &Filter{
        Conditions: []*FilterCondition{
            {Column: "status", Operator: "=", Value: "active"},
        },
    }
    
    b.ResetTimer() // 重置计时器，排除准备时间
    for i := 0; i < b.N; i++ {
        FilterRows(rows, filter)
    }
}

// BenchmarkFilterRows_MediumDataset 测试中等数据集性能
func BenchmarkFilterRows_MediumDataset(b *testing.B) {
    rows := generateTestRows(1000)
    filter := &Filter{
        Conditions: []*FilterCondition{
            {Column: "status", Operator: "=", Value: "active"},
            {Column: "priority", Operator: ">", Value: "5"},
        },
    }
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        FilterRows(rows, filter)
    }
}

// BenchmarkFilterRows_LargeDataset 测试大数据集性能
func BenchmarkFilterRows_LargeDataset(b *testing.B) {
    rows := generateTestRows(10000)
    filter := &Filter{
        Conditions: []*FilterCondition{
            {Column: "status", Operator: "=", Value: "active"},
            {Column: "priority", Operator: ">", Value: "5"},
            {Column: "category", Operator: "in", Value: []string{"A", "B", "C"}},
        },
    }
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        FilterRows(rows, filter)
    }
}

// BenchmarkFilterRows_ComplexConditions 测试复杂条件性能
func BenchmarkFilterRows_ComplexConditions(b *testing.B) {
    rows := generateTestRows(1000)
    filter := &Filter{
        Conditions: []*FilterCondition{
            {Column: "status", Operator: "=", Value: "active"},
            {Column: "priority", Operator: "between", Value: []int{1, 10}},
            {Column: "tags", Operator: "contains", Value: "important"},
            {Column: "created_at", Operator: ">=", Value: "2024-01-01"},
        },
    }
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        FilterRows(rows, filter)
    }
}

// 辅助函数：生成测试数据
func generateTestRows(count int) []*Row {
    rows := make([]*Row, count)
    for i := 0; i < count; i++ {
        rows[i] = &Row{
            ID: fmt.Sprintf("row-%d", i),
            Cells: map[string]*Cell{
                "status":     {Value: randomStatus()},
                "priority":   {Value: randomInt(1, 10)},
                "category":   {Value: randomCategory()},
                "tags":       {Value: randomTags()},
                "created_at": {Value: randomDate()},
            },
        }
    }
    return rows
}
```

#### 2.2.3 运行基准测试

```bash
# 运行所有基准测试
go test -bench=. -benchmem ./kernel/av/

# 运行特定基准测试
go test -bench=BenchmarkFilterRows -benchmem ./kernel/av/

# 运行多次以获得更稳定的结果
go test -bench=. -benchmem -count=10 ./kernel/av/

# 保存基准测试结果
go test -bench=. -benchmem -count=10 ./kernel/av/ > baseline.txt
```

### 2.3 记录当前性能指标

#### 2.3.1 性能指标收集

创建性能基线报告模板：

```markdown
# 性能基线报告

## 测试环境
- **操作系统**：Windows 11 / Linux / macOS
- **CPU**：Intel Core i7-12700K / AMD Ryzen 9 5900X
- **内存**：32GB DDR4 3200MHz
- **Go 版本**：go1.21.5
- **测试时间**：2026-01-26 12:00:00

## 基准测试结果

### 小数据集（100 行）
```
BenchmarkFilterRows_SmallDataset-12    50000    25000 ns/op    8192 B/op    100 allocs/op
```

### 中等数据集（1000 行）
```
BenchmarkFilterRows_MediumDataset-12   5000     250000 ns/op   81920 B/op   1000 allocs/op
```

### 大数据集（10000 行）
```
BenchmarkFilterRows_LargeDataset-12    500      2500000 ns/op  819200 B/op  10000 allocs/op
```

## 性能瓶颈分析
- 主要瓶颈：字符串比较操作
- 内存分配：每次过滤都会创建新的切片
- CPU 使用：条件判断占用 60% 时间
```

#### 2.3.2 使用 pprof 进行性能分析

```go
// filter_profile_test.go
package av

import (
    "os"
    "runtime/pprof"
    "testing"
)

func TestFilterRows_Profile(t *testing.T) {
    // CPU 性能分析
    cpuProfile, _ := os.Create("cpu.prof")
    defer cpuProfile.Close()
    pprof.StartCPUProfile(cpuProfile)
    defer pprof.StopCPUProfile()
    
    // 运行测试
    rows := generateTestRows(10000)
    filter := &Filter{
        Conditions: []*FilterCondition{
            {Column: "status", Operator: "=", Value: "active"},
        },
    }
    
    for i := 0; i < 1000; i++ {
        FilterRows(rows, filter)
    }
    
    // 内存性能分析
    memProfile, _ := os.Create("mem.prof")
    defer memProfile.Close()
    pprof.WriteHeapProfile(memProfile)
}
```

```bash
# 分析 CPU 性能
go tool pprof cpu.prof

# 分析内存使用
go tool pprof mem.prof

# 生成可视化报告
go tool pprof -http=:8080 cpu.prof
```

### 2.4 确保所有现有测试通过

#### 2.4.1 运行完整测试套件

```bash
# 运行所有测试
go test ./kernel/av/... -v

# 运行测试并生成覆盖率报告
go test ./kernel/av/... -coverprofile=coverage.out

# 查看覆盖率
go tool cover -html=coverage.out

# 检查测试覆盖率是否达标（建议 ≥ 80%）
go tool cover -func=coverage.out | grep total
```

#### 2.4.2 测试通过检查清单

- [ ] 所有单元测试通过（100%）
- [ ] 测试覆盖率 ≥ 80%（理想 ≥ 90%）
- [ ] 没有竞态条件（`go test -race`）
- [ ] 没有内存泄漏
- [ ] 集成测试通过

---

## 3. 功能等价性验证

### 3.1 单元测试覆盖率要求

#### 3.1.1 覆盖率目标

- **最低要求**：≥ 80%
- **推荐目标**：≥ 90%
- **理想目标**：≥ 95%

#### 3.1.2 覆盖率类型

1. **语句覆盖率**（Statement Coverage）：每条语句至少执行一次
2. **分支覆盖率**（Branch Coverage）：每个条件分支都被测试
3. **路径覆盖率**（Path Coverage）：所有可能的执行路径都被测试

#### 3.1.3 提高覆盖率的策略

```go
// filter_test.go
package av

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

// TestFilterRows_AllOperators 测试所有操作符
func TestFilterRows_AllOperators(t *testing.T) {
    tests := []struct {
        name     string
        operator string
        value    interface{}
        expected int
    }{
        {"等于", "=", "active", 5},
        {"不等于", "!=", "inactive", 8},
        {"大于", ">", 5, 6},
        {"大于等于", ">=", 5, 7},
        {"小于", "<", 5, 4},
        {"小于等于", "<=", 5, 5},
        {"包含", "contains", "test", 3},
        {"不包含", "not_contains", "test", 7},
        {"为空", "is_empty", nil, 2},
        {"不为空", "is_not_empty", nil, 8},
        {"在列表中", "in", []string{"A", "B"}, 4},
        {"不在列表中", "not_in", []string{"A", "B"}, 6},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            rows := generateTestRows(10)
            filter := &Filter{
                Conditions: []*FilterCondition{
                    {Column: "status", Operator: tt.operator, Value: tt.value},
                },
            }
            
            result := FilterRows(rows, filter)
            assert.Equal(t, tt.expected, len(result))
        })
    }
}
```

### 3.2 边界条件测试

#### 3.2.1 边界条件类型

1. **空数据**：空切片、空字符串、nil 值
2. **单元素**：只有一个元素的情况
3. **大数据**：极大数据集
4. **特殊值**：零值、负数、极值

#### 3.2.2 边界条件测试示例

```go
// filter_boundary_test.go
package av

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

// TestFilterRows_EmptyInput 测试空输入
func TestFilterRows_EmptyInput(t *testing.T) {
    tests := []struct {
        name   string
        rows   []*Row
        filter *Filter
    }{
        {
            name:   "空行切片",
            rows:   []*Row{},
            filter: &Filter{Conditions: []*FilterCondition{{Column: "status", Operator: "=", Value: "active"}}},
        },
        {
            name:   "nil 行切片",
            rows:   nil,
            filter: &Filter{Conditions: []*FilterCondition{{Column: "status", Operator: "=", Value: "active"}}},
        },
        {
            name:   "空过滤条件",
            rows:   generateTestRows(10),
            filter: &Filter{Conditions: []*FilterCondition{}},
        },
        {
            name:   "nil 过滤器",
            rows:   generateTestRows(10),
            filter: nil,
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // 不应该 panic
            assert.NotPanics(t, func() {
                result := FilterRows(tt.rows, tt.filter)
                assert.NotNil(t, result)
            })
        })
    }
}

// TestFilterRows_SingleElement 测试单元素
func TestFilterRows_SingleElement(t *testing.T) {
    rows := generateTestRows(1)
    filter := &Filter{
        Conditions: []*FilterCondition{
            {Column: "status", Operator: "=", Value: "active"},
        },
    }
    
    result := FilterRows(rows, filter)
    assert.LessOrEqual(t, len(result), 1)
}

// TestFilterRows_LargeDataset 测试大数据集
func TestFilterRows_LargeDataset(t *testing.T) {
    rows := generateTestRows(100000)
    filter := &Filter{
        Conditions: []*FilterCondition{
            {Column: "status", Operator: "=", Value: "active"},
        },
    }
    
    // 不应该超时或内存溢出
    result := FilterRows(rows, filter)
    assert.NotNil(t, result)
}

// TestFilterRows_SpecialValues 测试特殊值
func TestFilterRows_SpecialValues(t *testing.T) {
    tests := []struct {
        name  string
        value interface{}
    }{
        {"零值", 0},
        {"负数", -1},
        {"最大整数", int(^uint(0) >> 1)},
        {"空字符串", ""},
        {"Unicode 字符", "测试🎉"},
        {"特殊字符", "!@#$%^&*()"},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            rows := generateTestRows(10)
            filter := &Filter{
                Conditions: []*FilterCondition{
                    {Column: "value", Operator: "=", Value: tt.value},
                },
            }
            
            assert.NotPanics(t, func() {
                FilterRows(rows, filter)
            })
        })
    }
}
```

