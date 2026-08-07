# File Browser Traversal Benchmark

该工具在同一棵真实目录树上比较 S-Forge Windows 原生流式扫描、Go 标准库、常用 Go walker、SACAssetsManager 最终 `fdirModified`、stock `fdir` 和 `fast-glob`。验证轮计算无序路径摘要；计时轮只统计条目，避免摘要计算主导遍历耗时。`godirwalk` 同时测试默认排序路径和声明为更快的 unsorted 路径，后者的实现错误会原样记录，不用吞掉错误换取耗时数字。

小规模开发验证先使用创建时生成的独立清单校验集合，再进入计时。默认均衡形状：

```powershell
go run . -fixture=true -warmups=1 -iterations=3
```

宽目录、深目录和大量空目录分别运行，避免单一形状偏置：

```powershell
go run . -fixture=true -fixture-shape=wide -fixture-count=4096 -warmups=1 -iterations=3
go run . -fixture=true -fixture-shape=deep -fixture-depth=96 -warmups=1 -iterations=3
go run . -fixture=true -fixture-shape=empty -fixture-count=4096 -warmups=1 -iterations=3
```

S-Forge 正式计时与其他 walker 一样执行路径流式回调。无 visitor 的纯计数快路径只用于生产内部计数，不进入横向性能排名。

整个 D 盘验收以 `filepath.WalkDir` 的同轮实时快照作为集合参照，S-Forge 不作为自己的正确性基线：

```powershell
go run . -fixture=false -root 'D:\' -warmups=1 -iterations=1 -timeout=4h -output '../../.dev-workspace/temp/filebrowser-bench/d-drive.json'
```

`fast-glob`、stock `fdir` 和修改版 `fdir` 直接从 `-sac-root` 指定的 SACAssetsManager 检出加载。整盘结果只代表同一机器当次文件系统状态；Windows 文件缓存、杀毒软件和扫描期间文件变化必须与结果一起记录。
