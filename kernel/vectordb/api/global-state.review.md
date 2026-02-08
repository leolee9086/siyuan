# 💩 API 里的全局变量这种懒惰行为

> 审阅对象: `kernel/vectordb/api.go`
> 严重程度: **Moderate**

```go
var (
	// Global DB Instance for API
	// In real app this should be injected
	GlobalDB   *Database
    // ...
)
```

"In real app this should be injected".

**这就是 Real App。**

我不喜欢看到这种借口。因为你用了全局变量，这就意味着如果我想跑并行测试，或者在一个进程里起两个 DB 实例（比如测试迁移），我就要在全局状态上打架。

## 怎么修

不要偷懒。

1. 定义一个 `Server` 或者 `Handler` 结构体。
2. 把 `Database` 也就是你的 `*Database` 实例放在里面。
3. 把所有的 `Handler` 函数变成这个结构体的方法。

```go
type Server struct {
    db *Database
}

func (s *Server) createCollectionHandler(c *gin.Context) { ... }
```

全局变量是万恶之源。现在的代码看起来像是为了赶工期写的 demo。
