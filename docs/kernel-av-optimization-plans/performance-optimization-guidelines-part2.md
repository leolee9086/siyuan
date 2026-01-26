# 性能优化工程规范指南（续）

## 3.3 异常情况测试

### 3.3.1 异常类型

1. **输入异常**：无效的输入参数
2. **状态异常**：不一致的内部状态
3. **资源异常**：资源不足或不可用
4. **并发异常**：竞态条件和死锁

### 3.3.2 异常测试示例

```go
// filter_exception_test.go
package av

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

// TestFilterRows_InvalidOperator 测试无效操作符
func TestFilterRows_InvalidOperator(t *testing.T) {
    rows := generateTestRows(10)
    filter := &Filter{
        Conditions: []*FilterCondition{
            {Column: "status", Operator: "invalid_op", Value: "active"},
        },
    }
    
    // 应该返回错误或空结果，而不是 panic
    assert.NotPanics(t, func() {
        result := FilterRows(rows, filter)
        assert.NotNil(t, result)
    })
}

// TestFilterRows_TypeMismatch 测试类型不匹配
func TestFilterRows_TypeMismatch(t *testing.T) {
    rows := generateTestRows(10)
    filter := &Filter{
        Conditions: []*FilterCondition{
            {Column: "priority", Operator: ">", Value: "not_a_number"}, // 应该是数字
        },
    }
    
    assert.NotPanics(t, func() {
        FilterRows(rows, filter)
    })
}

// TestFilterRows_NonExistentColumn 测试不存在的列
func TestFilterRows_NonExistentColumn(t *testing.T) {
    rows := generateTestRows(10)
    filter := &Filter{
        Conditions: []*FilterCondition{
            {Column: "non_existent_column", Operator: "=", Value: "value"},
        },
    }
    
    result := FilterRows(rows, filter)
    assert.NotNil(t, result)
}
```

### 3.4 回归测试

#### 3.4.1 回归测试策略

回归测试确保优化后的代码不会破坏现有功能：

```go
// filter_regression_test.go
package av

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

// TestFilterRows_RegressionSuite 回归测试套件
func TestFilterRows_RegressionSuite(t *testing.T) {
    // 收集所有已知的测试用例
    testCases := []struct {
        name     string
        rows     []*Row
        filter   *Filter
        expected int
    }{
        // 从历史 bug 报告中提取的测试用例
        {
            name: "Issue #123: 空字符串过滤失败",
            rows: []*Row{
                {ID: "1", Cells: map[string]*Cell{"name": {Value: ""}}},
                {ID: "2", Cells: map[string]*Cell{"name": {Value: "test"}}},
            },
            filter: &Filter{
                Conditions: []*FilterCondition{
                    {Column: "name", Operator: "is_empty", Value: nil},
                },
            },
            expected: 1,
        },
        {
            name: "Issue #456: 多条件 AND 逻辑错误",
            rows: generateTestRows(100),
            filter: &Filter{
                Logic: "AND",
                Conditions: []*FilterCondition{
                    {Column: "status", Operator: "=", Value: "active"},
                    {Column: "priority", Operator: ">", Value: 5},
                },
            },
            expected: 30,
        },
        // 添加更多历史测试用例...
    }
    
    for _, tc := range testCases {
        t.Run(tc.name, func(t *testing.T) {
            result := FilterRows(tc.rows, tc.filter)
            assert.Equal(t, tc.expected, len(result), "回归测试失败")
        })
    }
}
```

### 3.5 对比测试（原始实现 vs 优化实现）

#### 3.5.1 创建等价性测试框架

```go
// filter_equivalence_test.go
package av

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

// TestFilterRows_Equivalence 等价性测试
func TestFilterRows_Equivalence(t *testing.T) {
    // 生成大量随机测试用例
    testCases := generateRandomTestCases(1000)
    
    for i, tc := range testCases {
        t.Run(fmt.Sprintf("Case_%d", i), func(t *testing.T) {
            // 使用原始实现
            originalResult := FilterRowsOriginal(tc.rows, tc.filter)
            
            // 使用优化实现
            optimizedResult := FilterRows(tc.rows, tc.filter)
            
            // 验证结果完全一致
            assert.Equal(t, len(originalResult), len(optimizedResult), 
                "结果数量不一致")
            
            // 验证每一行的内容
            for j := range originalResult {
                assert.Equal(t, originalResult[j].ID, optimizedResult[j].ID,
                    "行 ID 不一致")
            }
        })
    }
}

// generateRandomTestCases 生成随机测试用例
func generateRandomTestCases(count int) []TestCase {
    cases := make([]TestCase, count)
    for i := 0; i < count; i++ {
        cases[i] = TestCase{
            rows:   generateTestRows(rand.Intn(1000) + 1),
            filter: generateRandomFilter(),
        }
    }
    return cases
}
```

---

## 4. 性能验证规范

### 4.1 基准测试运行次数

#### 4.1.1 推荐运行次数

- **最低要求**：≥ 5 次
- **推荐标准**：≥ 10 次
- **严格标准**：≥ 30 次

#### 4.1.2 运行基准测试

```bash
# 运行 10 次基准测试
go test -bench=BenchmarkFilterRows -benchmem -count=10 ./kernel/av/ | tee benchmark_results.txt

# 使用 benchstat 工具进行统计分析
go install golang.org/x/perf/cmd/benchstat@latest

# 对比优化前后的性能
benchstat baseline.txt optimized.txt
```

### 4.2 统计分析方法

#### 4.2.1 关键统计指标

1. **平均值（Mean）**：所有测试运行的平均性能
2. **中位数（Median）**：排序后中间位置的值，更能抵抗异常值
3. **标准差（Standard Deviation）**：衡量性能稳定性
4. **置信区间（Confidence Interval）**：95% 置信区间

#### 4.2.2 使用 benchstat 进行分析

```bash
# 保存优化前的基准测试结果
go test -bench=BenchmarkFilterRows -benchmem -count=10 ./kernel/av/ > baseline.txt

# 进行优化...

# 保存优化后的基准测试结果
go test -bench=BenchmarkFilterRows -benchmem -count=10 ./kernel/av/ > optimized.txt

# 统计分析对比
benchstat baseline.txt optimized.txt
```

**输出示例**：
```
name                          old time/op    new time/op    delta
FilterRows_SmallDataset-12      25.0µs ± 2%    15.0µs ± 1%  -40.00%  (p=0.000 n=10+10)
FilterRows_MediumDataset-12      250µs ± 3%     120µs ± 2%  -52.00%  (p=0.000 n=10+10)
FilterRows_LargeDataset-12      2.50ms ± 4%    1.00ms ± 2%  -60.00%  (p=0.000 n=10+10)

name                          old alloc/op   new alloc/op   delta
FilterRows_SmallDataset-12      8.19kB ± 0%    4.10kB ± 0%  -49.94%  (p=0.000 n=10+10)
FilterRows_MediumDataset-12     81.9kB ± 0%    41.0kB ± 0%  -49.94%  (p=0.000 n=10+10)
FilterRows_LargeDataset-12       819kB ± 0%     410kB ± 0%  -49.94%  (p=0.000 n=10+10)

name                          old allocs/op  new allocs/op  delta
FilterRows_SmallDataset-12        100 ± 0%        50 ± 0%  -50.00%  (p=0.000 n=10+10)
FilterRows_MediumDataset-12      1.00k ± 0%     0.50k ± 0%  -50.00%  (p=0.000 n=10+10)
FilterRows_LargeDataset-12       10.0k ± 0%      5.0k ± 0%  -50.00%  (p=0.000 n=10+10)
```

#### 4.2.3 自定义统计分析脚本

```go
// benchmark_stats.go
package main

import (
    "fmt"
    "math"
    "sort"
)

type BenchmarkResult struct {
    Name      string
    TimeNs    []int64
    AllocBytes []int64
    Allocs    []int64
}

func (br *BenchmarkResult) CalculateStats() Stats {
    return Stats{
        TimeMean:   mean(br.TimeNs),
        TimeMedian: median(br.TimeNs),
        TimeStdDev: stdDev(br.TimeNs),
        AllocMean:  mean(br.AllocBytes),
    }
}

type Stats struct {
    TimeMean   float64
    TimeMedian float64
    TimeStdDev float64
    AllocMean  float64
}

func mean(values []int64) float64 {
    sum := int64(0)
    for _, v := range values {
        sum += v
    }
    return float64(sum) / float64(len(values))
}

func median(values []int64) float64 {
    sorted := make([]int64, len(values))
    copy(sorted, values)
    sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
    
    n := len(sorted)
    if n%2 == 0 {
        return float64(sorted[n/2-1]+sorted[n/2]) / 2
    }
    return float64(sorted[n/2])
}

func stdDev(values []int64) float64 {
    m := mean(values)
    variance := 0.0
    for _, v := range values {
        diff := float64(v) - m
        variance += diff * diff
    }
    variance /= float64(len(values))
    return math.Sqrt(variance)
}
```

### 4.3 性能提升阈值定义

#### 4.3.1 性能提升等级

| 等级 | 性能提升 | 评价 |
|------|---------|------|
| 🔴 **回退** | < 0% | 性能下降，需要回滚 |
| 🟡 **微小** | 0% - 10% | 提升不明显，需要评估是否值得 |
| 🟢 **良好** | 10% - 30% | 明显提升，值得采纳 |
| 🟢 **优秀** | 30% - 50% | 显著提升 |
| 🟢 **卓越** | > 50% | 极大提升 |

#### 4.3.2 性能回归检测

```go
// performance_regression_test.go
package av

import (
    "testing"
)

// TestPerformanceRegression 性能回归检测
func TestPerformanceRegression(t *testing.T) {
    // 定义性能基线（从历史数据中获取）
    baseline := map[string]int64{
        "BenchmarkFilterRows_SmallDataset":  25000,  // 25µs
        "BenchmarkFilterRows_MediumDataset": 250000, // 250µs
        "BenchmarkFilterRows_LargeDataset":  2500000, // 2.5ms
    }
    
    // 运行当前基准测试
    results := runBenchmarks()
    
    // 检查是否有性能回归
    for name, baselineTime := range baseline {
        currentTime := results[name]
        
        // 允许 10% 的性能波动
        threshold := float64(baselineTime) * 1.10
        
        if float64(currentTime) > threshold {
            t.Errorf("性能回归检测失败: %s\n  基线: %d ns/op\n  当前: %d ns/op\n  回归: %.2f%%",
                name, baselineTime, currentTime,
                (float64(currentTime)/float64(baselineTime)-1)*100)
        }
    }
}
```

### 4.4 内存使用分析

#### 4.4.1 内存分析工具

```bash
# 运行内存基准测试
go test -bench=BenchmarkFilterRows -benchmem ./kernel/av/

# 生成内存 profile
go test -bench=BenchmarkFilterRows -memprofile=mem.prof ./kernel/av/

# 分析内存使用
go tool pprof mem.prof

# 在 pprof 交互模式中：
# (pprof) top10          # 查看前 10 个内存消耗最大的函数
# (pprof) list FilterRows # 查看 FilterRows 函数的详细内存分配
# (pprof) web            # 生成可视化图表
```

#### 4.4.2 内存泄漏检测

```go
// filter_memory_test.go
package av

import (
    "runtime"
    "testing"
)

// TestFilterRows_MemoryLeak 内存泄漏检测
func TestFilterRows_MemoryLeak(t *testing.T) {
    // 强制 GC
    runtime.GC()
    
    // 记录初始内存
    var m1 runtime.MemStats
    runtime.ReadMemStats(&m1)
    
    // 执行大量操作
    rows := generateTestRows(10000)
    filter := &Filter{
        Conditions: []*FilterCondition{
            {Column: "status", Operator: "=", Value: "active"},
        },
    }
    
    for i := 0; i < 1000; i++ {
        FilterRows(rows, filter)
    }
    
    // 强制 GC
    runtime.GC()
    
    // 记录最终内存
    var m2 runtime.MemStats
    runtime.ReadMemStats(&m2)
    
    // 检查内存增长
    memGrowth := m2.Alloc - m1.Alloc
    if memGrowth > 1024*1024 { // 1MB
        t.Errorf("可能存在内存泄漏: 内存增长 %d bytes", memGrowth)
    }
}
```

---

## 5. 代码质量标准

### 5.1 代码可读性

#### 5.1.1 命名规范

```go
// ❌ 不好的命名
func f(r []*R, f *F) []*R {
    res := []*R{}
    for _, x := range r {
        if c(x, f) {
            res = append(res, x)
        }
    }
    return res
}

// ✅ 好的命名
func FilterRows(rows []*Row, filter *Filter) []*Row {
    filteredRows := make([]*Row, 0, len(rows))
    for _, row := range rows {
        if matchesFilter(row, filter) {
            filteredRows = append(filteredRows, row)
        }
    }
    return filteredRows
}
```

#### 5.1.2 函数复杂度控制

- **圈复杂度**：≤ 10（推荐 ≤ 5）
- **函数长度**：≤ 50 行（推荐 ≤ 30 行）
- **参数数量**：≤ 5 个（推荐 ≤ 3 个）

```go
// ❌ 复杂度过高
func FilterRows(rows []*Row, filter *Filter) []*Row {
    result := []*Row{}
    for _, row := range rows {
        match := true
        for _, cond := range filter.Conditions {
            cell := row.Cells[cond.Column]
            if cell == nil {
                match = false
                break
            }
            switch cond.Operator {
            case "=":
                if cell.Value != cond.Value {
                    match = false
                }
            case "!=":
                if cell.Value == cond.Value {
                    match = false
                }
            // ... 更多条件
            }
        }
        if match {
            result = append(result, row)
        }
    }
    return result
}

// ✅ 拆分为小函数
func FilterRows(rows []*Row, filter *Filter) []*Row {
    filteredRows := make([]*Row, 0, len(rows))
    for _, row := range rows {
        if matchesAllConditions(row, filter.Conditions) {
            filteredRows = append(filteredRows, row)
        }
    }
    return filteredRows
}

func matchesAllConditions(row *Row, conditions []*FilterCondition) bool {
    for _, condition := range conditions {
        if !matchesCondition(row, condition) {
            return false
        }
    }
    return true
}

func matchesCondition(row *Row, condition *FilterCondition) bool {
    cell := row.Cells[condition.Column]
    if cell == nil {
        return false
    }
    return evaluateOperator(cell.Value, condition.Operator, condition.Value)
}
```

### 5.2 注释完整性

#### 5.2.1 函数注释

```go
// FilterRows 根据给定的过滤条件筛选行数据
//
// 参数：
//   - rows: 待过滤的行切片，可以为 nil 或空切片
//   - filter: 过滤条件，包含多个条件和逻辑关系（AND/OR）
//
// 返回：
//   - 满足过滤条件的行切片，如果没有匹配的行则返回空切片（非 nil）
//
// 性能特征：
//   - 时间复杂度：O(n * m)，其中 n 是行数，m 是条件数
//   - 空间复杂度：O(k)，其中 k 是匹配的行数
//
// 示例：
//   rows := []*Row{{ID: "1", Cells: map[string]*Cell{"status": {Value: "active"}}}}
//   filter := &Filter{Conditions: []*FilterCondition{{Column: "status", Operator: "=", Value: "active"}}}
//   result := FilterRows(rows, filter) // 返回包含一行的切片
func FilterRows(rows []*Row, filter *Filter) []*Row {
    // 实现...
}
```

#### 5.2.2 复杂逻辑注释

```go
func optimizedFilter(rows []*Row, filter *Filter) []*Row {
    // 预分配结果切片，避免多次扩容
    // 假设 30% 的行会匹配（基于历史数据统计）
    estimatedSize := len(rows) * 3 / 10
    filteredRows := make([]*Row, 0, estimatedSize)
    
    // 提前构建条件评估器，避免在循环中重复创建
    // 这个优化在条件数量 > 3 时效果显著（性能提升约 25%）
    evaluators := buildConditionEvaluators(filter.Conditions)
    
    for _, row := range rows {
        // 使用短路评估，一旦发现不匹配立即跳过
        if evaluateWithShortCircuit(row, evaluators) {
            filteredRows = append(filteredRows, row)
        }
    }
    
    return filteredRows
}
```

