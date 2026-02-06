# 🔥 Linus·织的代码审查：vectordb/vamana 模块 (第二轮)

> 审阅时间: 2026-02-07 00:38
> 审阅范围: `kernel/vectordb/vamana/` 全模块
> 风格: Linus Torvalds 附体版

---

好，我看到你改了一些东西。让我们来看看你改得怎么样。

---

## ✅ 已修复的问题

| 问题 | 状态 | 评价 |
|------|------|------|
| `_ = err` 吞错误 | ✅ 已修复 | 改成了 `fmt.Fprintf(os.Stderr, ...)` |
| Magic number `1e9` | ✅ 已修复 | 定义了 `LargeInvalidDistance` 常量 |
| 自制 `popcount64` | ✅ 已修复 | 改用 `bits.OnesCount64` |
| robustPrune 重复代码 | ✅ 已修复 | 提取了 `robustPruneCore` 公共函数 |

**好，你听进去了一些。但是...**

---

## 💀 问题一：你管这叫日志？

```go
// disk_index.go:178
fmt.Fprintf(os.Stderr, "vamana: warning: failed to load BBQ codes from %s: %v\n", bbqPath, err)

// disk_index.go:214
fmt.Fprintf(os.Stderr, "vamana: warning: failed to save deleted bitmap to %s: %v\n", deletedPath, err)
```

**`fmt.Fprintf(os.Stderr, ...)`？？？** 这是2026年了，不是1995年！

你知道这个项目肯定有日志系统吧？`siyuan/kernel` 里面肯定有 `logging` 包。把警告写到 stderr 是什么操作？生产环境里谁会去看 stderr？

而且你这个格式 `"vamana: warning: ..."` 是纯手工拼接的，没有时间戳、没有日志级别、没有调用栈。**这不是日志，这是 printf debugging。**

---

## 💀 问题二：Contains 还是 O(n) 线性搜索

```go
// types.go:59-66
func (a *AdjacencyList) Contains(id uint32) bool {
    for i := 0; i < a.length; i++ {
        if a.neighbors[i] == id {
            return true
        }
    }
    return false
}
```

这个你没改。MaxDegree=128，每次Push都要线性扫描一遍检查去重。

你说这是"优化"是因为用了固定大小数组避免slice分配？**但是你的查找是O(n)的！** 你优化了内存分配，却忽略了最基本的算法复杂度。

方案很简单：要么用 `map[uint32]struct{}` 做辅助查找，要么直接 `sort.Search` 保持有序插入。128个元素线性扫描确实不算慢，但这是**原则问题**。

---

## 💀 问题三：包级别函数变量还在

```go
// disk_index.go:559
var OpenDiskIndexReader func(path string, readOnly bool) (storage.DiskIndexReader, error)
```

这个你也没改。我之前说了，这是个**全局可变状态**。

如果有两个goroutine同时修改这个变量会怎样？如果有人忘记初始化会怎样？——运行时panic。

正确的做法：
1. 用接口 + 构造函数注入
2. 或者用 `sync.Once` 保护的初始化
3. 或者干脆用常规的工厂函数

**不是用一个裸的包级别函数指针！**

---

## 💀 问题四：注释语言还是混搭风

```go
// disk_index.go:232-233
// Internal Loading Functions
// ============================================================================

// disk_index.go:293
// loadBBQCodesV2 加载版本 2 的 BBQ 文件（包含完整量化元数据）
```

一会儿英文一会儿中文。你到底是要给谁看？

**选一个语言，坚持用到底。** 这是中文项目，那就全中文。英文函数名可以保留，但注释统一用中文。

---

## 💀 问题五：robustPruneWithScratch 的零值初始化循环

```go
// build.go:491-493
scratch.OccludeFactor = scratch.OccludeFactor[:n]
for i := range scratch.OccludeFactor {
    scratch.OccludeFactor[i] = 0
}
```

你知道切片reslice之后，底层数组的值不会自动清零吧？所以你手动写了个循环清零。

但是... **Go有 `clear()` 内置函数**（Go 1.21+）。或者用 `copy` 从一个零值slice复制过来。

一个for循环清零不是不行，但这显示你对Go的新特性不够熟悉。

---

## 💀 问题六：错误信息不统一

```go
// 有的地方用 fmt.Errorf:
return nil, fmt.Errorf("failed to open index file: %w", err)

// 有的地方用预定义错误:
return nil, ErrBBQMagicMismatch

// 有的地方用 storage 包的错误:
return nil, storage.ErrCorruptedFile
```

三种风格混用。调用者怎么判断错误类型？用 `errors.Is`？用 `errors.As`？用字符串匹配？

**统一一下！** 要么全用预定义错误+wrap，要么建立一个清晰的错误类型层次。

---

## 📋 总结

你改了4个问题，但还有至少6个问题没改。

| 问题 | 严重程度 | 状态 |
|------|----------|------|
| 用 stderr 代替正规日志 | 🔴 高 | ❌ 未修 |
| O(n) Contains搜索 | 🟡 中 | ❌ 未修 |
| 包级别函数变量 | 🟡 中 | ❌ 未修 |
| 注释语言混搭 | 🟢 低 | ❌ 未修 |
| 手动循环清零 | � 低 | ❌ 未修 |
| 错误类型不统一 | 🟡 中 | ❌ 未修 |

**下次见面之前把这些都改了，否则我会更不客气。**

---

*—— Linus·织，2026年2月7日凌晨*
