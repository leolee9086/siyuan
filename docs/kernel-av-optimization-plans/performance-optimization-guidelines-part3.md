# 性能优化工程规范指南（续3）

### 5.3 错误处理

#### 5.3.1 错误处理原则

1. **明确错误类型**：区分可恢复错误和不可恢复错误
2. **提供上下文**：错误信息应包含足够的上下文信息
3. **避免 panic**：除非是真正的程序错误，否则返回 error
4. **错误传播**：适当地包装和传播错误

#### 5.3.2 错误处理示例

```go
// ❌ 不好的错误处理
func FilterRows(rows []*Row, filter *Filter) []*Row {
    if filter == nil {
        panic("filter is nil") // 不应该 panic
    }
    // ...
}

// ✅ 好的错误处理
func FilterRows(rows []*Row, filter *Filter) ([]*Row, error) {
    if filter == nil {
        return nil, fmt.Errorf("filter cannot be nil")
    }
    
    if len(filter.Conditions) == 0 {
        // 没有条件时返回所有行，这是合法的
        return rows, nil
    }
    
    filteredRows := make([]*Row, 0, len(rows))
    for _, row := range rows {
        match, err := matchesFilter(row, filter)
        if err != nil {
            return nil, fmt.Errorf("failed to match row %s: %w", row.ID, err)
        }
        if match {
            filteredRows = append(filteredRows, row)
        }
    }
    
    return filteredRows, nil
}
```

#### 5.3.3 自定义错误类型

```go
// filter_errors.go
package av

import "fmt"

// FilterError 过滤操作错误
type FilterError struct {
    Op      string // 操作名称
    Column  string // 列名
    Err     error  // 底层错误
}

func (e *FilterError) Error() string {
    return fmt.Sprintf("filter error in %s on column %s: %v", e.Op, e.Column, e.Err)
}

func (e *FilterError) Unwrap() error {
    return e.Err
}

// 使用示例
func evaluateCondition(cell *Cell, condition *FilterCondition) (bool, error) {
    if cell == nil {
        return false, &FilterError{
            Op:     "evaluate",
            Column: condition.Column,
            Err:    fmt.Errorf("cell is nil"),
        }
    }
    // ...
}
```

### 5.4 资源管理

#### 5.4.1 内存管理

```go
// ✅ 预分配切片容量
func FilterRows(rows []*Row, filter *Filter) []*Row {
    // 预估结果大小，避免多次扩容
    estimatedSize := len(rows) / 2
    filteredRows := make([]*Row, 0, estimatedSize)
    
    for _, row := range rows {
        if matchesFilter(row, filter) {
            filteredRows = append(filteredRows, row)
        }
    }
    
    return filteredRows
}

// ✅ 复用缓冲区
var bufferPool = sync.Pool{
    New: func() interface{} {
        return make([]*Row, 0, 100)
    },
}

func FilterRowsWithPool(rows []*Row, filter *Filter) []*Row {
    // 从池中获取缓冲区
    filteredRows := bufferPool.Get().([]*Row)
    filteredRows = filteredRows[:0] // 重置长度
    
    for _, row := range rows {
        if matchesFilter(row, filter) {
            filteredRows = append(filteredRows, row)
        }
    }
    
    // 创建结果副本
    result := make([]*Row, len(filteredRows))
    copy(result, filteredRows)
    
    // 归还缓冲区到池
    bufferPool.Put(filteredRows)
    
    return result
}
```

#### 5.4.2 goroutine 管理

```go
// ✅ 使用 context 控制 goroutine 生命周期
func FilterRowsConcurrent(ctx context.Context, rows []*Row, filter *Filter) ([]*Row, error) {
    // 检查 context 是否已取消
    select {
    case <-ctx.Done():
        return nil, ctx.Err()
    default:
    }
    
    // 使用 errgroup 管理并发
    g, ctx := errgroup.WithContext(ctx)
    
    // 分批处理
    batchSize := len(rows) / runtime.NumCPU()
    results := make([][]*Row, runtime.NumCPU())
    
    for i := 0; i < runtime.NumCPU(); i++ {
        i := i
        start := i * batchSize
        end := start + batchSize
        if i == runtime.NumCPU()-1 {
            end = len(rows)
        }
        
        g.Go(func() error {
            batch := rows[start:end]
            filtered := make([]*Row, 0, len(batch)/2)
            
            for _, row := range batch {
                // 定期检查 context
                select {
                case <-ctx.Done():
                    return ctx.Err()
                default:
                }
                
                if matchesFilter(row, filter) {
                    filtered = append(filtered, row)
                }
            }
            
            results[i] = filtered
            return nil
        })
    }
    
    if err := g.Wait(); err != nil {
        return nil, err
    }
    
    // 合并结果
    totalSize := 0
    for _, r := range results {
        totalSize += len(r)
    }
    
    merged := make([]*Row, 0, totalSize)
    for _, r := range results {
        merged = append(merged, r...)
    }
    
    return merged, nil
}
```

### 5.5 并发安全性

#### 5.5.1 竞态条件检测

```bash
# 使用 -race 标志检测竞态条件
go test -race ./kernel/av/...

# 运行基准测试时也检测竞态条件
go test -race -bench=. ./kernel/av/
```

#### 5.5.2 并发安全的实现

```go
// ❌ 不安全的并发访问
type FilterCache struct {
    cache map[string][]*Row
}

func (fc *FilterCache) Get(key string) []*Row {
    return fc.cache[key] // 竞态条件
}

func (fc *FilterCache) Set(key string, rows []*Row) {
    fc.cache[key] = rows // 竞态条件
}

// ✅ 使用互斥锁保护
type FilterCache struct {
    mu    sync.RWMutex
    cache map[string][]*Row
}

func (fc *FilterCache) Get(key string) []*Row {
    fc.mu.RLock()
    defer fc.mu.RUnlock()
    return fc.cache[key]
}

func (fc *FilterCache) Set(key string, rows []*Row) {
    fc.mu.Lock()
    defer fc.mu.Unlock()
    fc.cache[key] = rows
}

// ✅ 使用 sync.Map（适合读多写少的场景）
type FilterCache struct {
    cache sync.Map
}

func (fc *FilterCache) Get(key string) ([]*Row, bool) {
    value, ok := fc.cache.Load(key)
    if !ok {
        return nil, false
    }
    return value.([]*Row), true
}

func (fc *FilterCache) Set(key string, rows []*Row) {
    fc.cache.Store(key, rows)
}
```

---

## 6. 文档要求

### 6.1 优化前后对比报告

#### 6.1.1 报告模板

```markdown
# Phase N 性能优化报告

## 1. 执行摘要

- **优化目标**：提升过滤操作性能
- **优化范围**：kernel/av/filter.go
- **性能提升**：平均提升 45%，最高提升 60%
- **风险评估**：低风险，已通过完整测试验证

## 2. 优化前状态

### 2.1 性能基线
- 小数据集（100 行）：25µs/op，8KB 内存，100 次分配
- 中等数据集（1000 行）：250µs/op，80KB 内存，1000 次分配
- 大数据集（10000 行）：2.5ms/op，800KB 内存，10000 次分配

### 2.2 主要问题
1. 每次过滤都创建新切片，导致大量内存分配
2. 字符串比较未优化
3. 条件评估重复计算

## 3. 优化措施

### 3.1 优化策略
1. **预分配切片容量**：根据历史数据预估结果大小
2. **条件预编译**：提前构建条件评估器
3. **短路评估**：一旦发现不匹配立即跳过

### 3.2 代码变更
- 修改文件：kernel/av/filter.go
- 新增文件：kernel/av/filter_evaluator.go
- 代码行数变化：+150 行，-80 行

## 4. 优化后状态

### 4.1 性能结果
- 小数据集（100 行）：15µs/op（提升 40%），4KB 内存（减少 50%），50 次分配（减少 50%）
- 中等数据集（1000 行）：120µs/op（提升 52%），40KB 内存（减少 50%），500 次分配（减少 50%）
- 大数据集（10000 行）：1.0ms/op（提升 60%），400KB 内存（减少 50%），5000 次分配（减少 50%）

### 4.2 统计分析
- 平均性能提升：45%
- 标准差：±2%
- 95% 置信区间：[43%, 47%]
- p 值：< 0.001（统计显著）

## 5. 功能验证

### 5.1 测试覆盖率
- 单元测试覆盖率：92%（优化前：85%）
- 所有测试通过：✅ 100%
- 竞态条件检测：✅ 通过

### 5.2 等价性验证
- 随机测试用例：1000 个
- 等价性验证：✅ 100% 一致

## 6. 风险评估

### 6.1 已知风险
- 无

### 6.2 缓解措施
- 完整的回归测试
- 保留原始实现备份
- 建立性能监控

## 7. 后续计划

### 7.1 监控指标
- 生产环境性能监控
- 错误率监控
- 内存使用监控

### 7.2 优化机会
- 考虑引入缓存机制
- 探索并发优化可能性
```

### 6.2 技术决策说明

#### 6.2.1 决策记录模板

```markdown
# 技术决策记录 (ADR)

## 决策编号
ADR-001

## 标题
使用预分配切片容量优化内存分配

## 状态
✅ 已采纳

## 上下文
在过滤操作中，每次都会创建新的切片来存储结果。由于不知道最终结果的大小，切片会多次扩容，导致：
1. 频繁的内存分配
2. 数据复制开销
3. GC 压力增加

## 决策
预分配切片容量，基于以下策略：
1. 使用历史数据统计，平均约 30% 的行会匹配
2. 预分配 `len(rows) * 3 / 10` 的容量
3. 如果预估不准，切片仍会自动扩容

## 理由
1. **性能提升**：减少 50% 的内存分配次数
2. **低风险**：即使预估不准，功能仍然正确
3. **简单实现**：只需修改一行代码

## 替代方案

### 方案 A：固定容量
- 优点：实现简单
- 缺点：可能浪费内存或仍需扩容

### 方案 B：动态调整
- 优点：更精确
- 缺点：增加复杂度，收益有限

### 方案 C：使用对象池
- 优点：进一步减少分配
- 缺点：增加复杂度，需要额外管理

## 后果

### 正面影响
- 内存分配减少 50%
- 性能提升 15-20%
- 代码改动最小

### 负面影响
- 如果预估严重不准，可能浪费少量内存
- 需要定期验证预估准确性

## 验证方法
1. 基准测试验证性能提升
2. 内存分析验证分配减少
3. 生产环境监控验证实际效果

## 相关决策
- ADR-002: 条件预编译优化
- ADR-003: 短路评估优化
```

### 6.3 已知限制和权衡

#### 6.3.1 限制文档模板

```markdown
# 已知限制和权衡

## 1. 性能限制

### 1.1 并发性能
**限制**：当前实现是单线程的，未充分利用多核 CPU。

**原因**：
- 并发实现会增加复杂度
- 小数据集并发开销大于收益
- 需要保持结果顺序

**权衡**：
- ✅ 代码简单，易于维护
- ✅ 小数据集性能更好
- ❌ 大数据集（>10000 行）性能未达到最优

**未来改进**：
- 当数据量 > 10000 时自动切换到并发模式
- 提供并发和非并发两个版本的 API

### 1.2 内存使用
**限制**：预分配策略基于 30% 匹配率的假设。

**原因**：
- 基于历史数据统计
- 需要在内存使用和性能之间平衡

**权衡**：
- ✅ 大多数情况下减少内存分配
- ❌ 匹配率很低时可能浪费内存
- ❌ 匹配率很高时仍需扩容

**未来改进**：
- 根据过滤条件动态调整预估
- 收集实际匹配率数据优化预估

## 2. 功能限制

### 2.1 复杂查询
**限制**：不支持嵌套的 AND/OR 逻辑。

**原因**：
- 当前需求不需要
- 实现复杂度高

**权衡**：
- ✅ 满足当前所有使用场景
- ✅ 代码简单
- ❌ 无法表达复杂查询

**未来改进**：
- 如果有需求，可以引入查询 AST

## 3. 兼容性限制

### 3.1 API 变更
**限制**：优化后的 API 与原始实现完全兼容。

**原因**：
- 避免破坏现有代码
- 降低迁移成本

**权衡**：
- ✅ 无需修改调用代码
- ❌ 无法引入更好的 API 设计

**未来改进**：
- 在下一个大版本中考虑 API 重构
```

### 6.4 回滚方案

#### 6.4.1 回滚计划

```markdown
# 回滚方案

## 1. 回滚触发条件

以下任一条件满足时应立即回滚：

1. **功能问题**
   - 发现功能不等价的 bug
   - 测试失败率 > 1%
   - 生产环境错误率增加 > 10%

2. **性能问题**
   - 性能回退 > 5%
   - 内存使用增加 > 20%
   - CPU 使用增加 > 20%

3. **稳定性问题**
   - 出现 panic 或崩溃
   - 内存泄漏
   - 死锁或竞态条件

## 2. 回滚步骤

### 2.1 使用 Git 回滚

```bash
# 方法 1：回滚到备份分支
git checkout backup/phase1-original
git checkout -b rollback/phase1
git push origin rollback/phase1

# 方法 2：使用 revert
git revert <commit-hash>
git push origin main

# 方法 3：使用 reset（仅本地）
git reset --hard <commit-hash>
```

### 2.2 使用文件备份回滚

```bash
# 恢复原始文件
cp kernel/av/filter.go.original kernel/av/filter.go

# 重新编译
go build ./kernel/av/

# 运行测试验证
go test ./kernel/av/...
```

### 2.3 回滚验证

```bash
# 1. 运行所有测试
go test ./kernel/av/... -v

# 2. 运行基准测试
go test -bench=. ./kernel/av/

# 3. 检查性能是否恢复
benchstat baseline.txt rollback.txt

# 4. 部署到测试环境验证
```

## 3. 回滚后分析

### 3.1 问题分析清单
- [ ] 记录回滚原因
- [ ] 分析根本原因
- [ ] 评估是否可以修复
- [ ] 制定改进计划

### 3.2 经验总结
- 哪些测试没有覆盖到问题？
- 如何改进测试策略？
- 如何避免类似问题？
```

---

## 7. 回滚和应急方案

### 7.1 版本控制策略

#### 7.1.1 分支管理

```bash
# 主分支：main
# 开发分支：feature/phase-N-optimization
# 备份分支：backup/phase-N-original
# 回滚分支：rollback/phase-N

# 工作流程
git checkout -b feature/phase1-optimization
# 进行优化...
git add .
git commit -m "feat: Phase 1 过滤操作性能优化"
git push origin feature/phase1-optimization

# 创建 Pull Request 进行代码审查
# 合并到 main 后，保留备份分支
```

#### 7.1.2 标签管理

```bash
# 在优化前打标签
git tag -a v1.0.0-pre-phase1 -m "Phase 1 优化前的版本"
git push origin v1.0.0-pre-phase1

# 在优化后打标签
git tag -a v1.0.0-phase1 -m "Phase 1 优化后的版本"
git push origin v1.0.0-phase1

# 如需回滚，可以直接切换到标签
git checkout v1.0.0-pre-phase1
```

### 7.2 监控和告警

#### 7.2.1 性能监控指标

```go
// performance_monitor.go
package av

import (
    "sync"
    "time"
)

// PerformanceMonitor 性能监控器
type PerformanceMonitor struct {
    mu sync.RWMutex
    
    // 统计指标
    totalCalls    int64
    totalDuration time.Duration
    errorCount    int64
    
    // 性能阈值
    maxDuration time.Duration
    errorRate   float64
}

// RecordCall 记录一次调用
func (pm *PerformanceMonitor) RecordCall(duration time.Duration, err error) {
    pm.mu.Lock()
    defer pm.mu.Unlock()
    
    pm.totalCalls++
    pm.totalDuration += duration
    
    if err != nil {
        pm.errorCount++
    }
    
    // 检查是否超过阈值
    if duration > pm.maxDuration {
        // 触发告警
        pm.alertSlowQuery(duration)
    }
    
    errorRate := float64(pm.errorCount) / float64(pm.totalCalls)
    if errorRate > pm.errorRate {
        // 触发告警
        pm.alertHighErrorRate(errorRate)
    }
}

// GetStats 获取统计信息
func (pm *PerformanceMonitor) GetStats() Stats {
    pm.mu.RLock()
    defer pm.mu.RUnlock()
    
    avgDuration := time.Duration(0)
    if pm.totalCalls > 0 {
        avgDuration = pm.totalDuration / time.Duration(pm.totalCalls)
    }
    
    return Stats{
        TotalCalls:    pm.totalCalls,
        AvgDuration:   avgDuration,
        ErrorCount:    pm.errorCount,
        ErrorRate:     float64(pm.errorCount) / float64(pm.totalCalls),
    }
}
```

