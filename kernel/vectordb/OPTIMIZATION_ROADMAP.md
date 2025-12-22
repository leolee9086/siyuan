# HNSW向量数据库性能优化路线图

> **目标**: 达到百万级数据下的高性能ANN查询

---

## 优先级排序

基于**收益/成本比**分析:

| 优先级 | 优化项 | 预计收益 | 实现难度 | 风险 |
|--------|--------|----------|----------|------|
| **P0** | Epoch-based Visited | 50%+ GC减少 | 低 | 低 |
| **P1** | 锁粒度优化 | 10x并发 | 中 | 中 |
| **P2** | SIMD距离计算 | 4-8x加速 | 中 | 低 |

---

## P0: Epoch-based Visited Set

### 问题
当前每次搜索都创建新的 `map[DocID]bool`:
```go
visited := make(map[DocID]bool)  // 每次分配!
```

### 解决方案
使用全局数组 + epoch计数器:
```go
type VectorStore struct {
    // ...
    visitedEpoch []uint32  // 每个节点的最后访问epoch
    currentEpoch uint32    // 当前搜索epoch
}

func (s *VectorStore) IsVisited(id DocID) bool {
    return s.visitedEpoch[id] == s.currentEpoch
}

func (s *VectorStore) MarkVisited(id DocID) {
    s.visitedEpoch[id] = s.currentEpoch
}

func (s *VectorStore) ResetVisited() {
    s.currentEpoch++  // O(1) 重置!
}
```

### 收益
- 消除map分配开销
- 减少GC压力
- O(1)重置 vs O(n)清空

---

## P1: 锁粒度优化

### 问题
当前所有操作共享一把锁:
```go
s.mu.RLock()  // 每次距离计算都锁!
```

### 解决方案
1. **读无锁**: 向量数组只追加不修改,读操作无需锁
2. **分段锁**: 不同DocID范围使用不同锁
3. **原子操作**: 使用atomic.LoadPointer

---

## P2: SIMD距离计算

> [!WARNING]
> **实验结论: 对BBQ量化架构收益有限,已回滚**

### 实验结果 (2025-12-23)
- 使用 `github.com/viterin/vek/vek32` 替换循环展开版本
- 插入: 697 → 720 (+3%) ✅
- 查询: 0.53ms → 1.56ms ❌ (反而变慢)

### 原因分析
1. **BBQ位运算主导**: 搜索时主要使用`计算打包位点积`(POPCNT),不是浮点距离
2. **精排占比小**: CosineDistance只在最终Top-K精排调用(~100次),占比<5%
3. **函数调用开销**: vek库引入额外函数调用,抵消了SIMD收益

### 建议
- 若要优化距离计算,应优化**BBQ位运算**(批量SIMD popcount)
- 或在**非BBQ场景**(dim<128)使用SIMD

---

## 验证命令

```bash
# 基准测试
go test -v -bench="BenchmarkHNSW.*1024" -benchmem -cpuprofile=cpu.prof .

# 分析热点
go tool pprof cpu.prof
```

---

## 下一步行动

**立即开始P0: Epoch-based Visited Set**

这是收益最高、风险最低的优化,预计1-2小时完成。
