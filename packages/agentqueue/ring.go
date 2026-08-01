// Package agentqueue 提供 agent 统一消息入口的优先级队列与 per-session 输入队列。
//
// 设计目标：
//   - 满足普通 agent（native agent）运行中消息注入、排队、引导、中断、异步工具返回的需求；
//   - 可直接替换 MAGI 目前使用的 DispatcherRingQueue（kernel/api/magi_priority_queue.go），
//     提供同等的保护环优先级语义（高环先处理、同环 FIFO、Push 非阻塞满则拒绝）；
//   - 语义与优先级分离：每条输入携带 Semantics（投递方式）与 Priority（调度顺序），
//     由调用方（API 端点 / 渠道桥 / 工具执行器）声明，调度核心不感知具体业务。
//
// 包内不依赖 kernel 任何包，保持独立可测试。
package agentqueue

import (
	"sync"
)

// Ring 表示任务优先级环层级，数值越小优先级越高，对应 CPU 保护环语义。
// 与 MAGI DispatcherRingQueue 的 TaskRing 常量保持一致（Ring0=外部消息、Ring1=心跳）。
type Ring int

const (
	// Ring0 最高优先级：即时交互（steer / interrupt / tool_result）。
	Ring0 Ring = 0
	// Ring1 高优先级：外部渠道消息（channel_inbound / cross_agent）。
	Ring1 Ring = 1
	// Ring2 普通优先级：用户消息与排队消息（user_message / queue）。
	Ring2 Ring = 2
	// Ring3 低优先级：后台系统任务（system / heartbeat）。
	Ring3 Ring = 3
)

// RingCount 是受支持的优先级环数量。
const RingCount = 4

// DefaultBufSize 是 NewRingQueue 在未指定缓冲容量时使用的默认每环缓冲大小。
const DefaultBufSize = 100

// NoRing 是 Peek 在队列为空时返回的哨兵值（不是合法的环层级）。
const NoRing = -1

// RingQueue 是按优先级环分级的 FIFO 队列，并发安全。
//
// 语义（与 MAGI DispatcherRingQueue 对齐）：
//   - Push 非阻塞：目标环缓冲满时返回 false，由调用方决定背压策略；
//   - PopBlocking 从高环到低环轮询，高环持续有任务时低环等待；
//   - 同一环内保持先进先出；
//   - Close 之后 Push 返回 false，已入队数据仍可被 Pop 排空。
//
// T 为队列承载的任务类型，MAGI 侧可实例化为 *DispatcherTask 直接替换原队列。
type RingQueue[T any] struct {
	rings [RingCount]chan T

	mu        sync.Mutex
	closed    bool
	closeCh   chan struct{}
	closeOnce sync.Once
}

// NewRingQueue 创建指定缓冲容量的优先队列。bufSize <= 0 时使用默认值 DefaultBufSize。
func NewRingQueue[T any](bufSize int) *RingQueue[T] {
	if bufSize <= 0 {
		bufSize = DefaultBufSize
	}
	q := &RingQueue[T]{closeCh: make(chan struct{})}
	for i := 0; i < RingCount; i++ {
		q.rings[i] = make(chan T, bufSize)
	}
	return q
}

// Push 按优先级环插入任务。队列已关闭或目标环满时返回 false（非阻塞）。
// 关闭状态检查与入队发送在同一临界区内完成，保证「Close 之后 Push 必然失败」
// 的严格语义（消除检查与发送之间的 TOCTOU 窗口）。
func (q *RingQueue[T]) Push(ring Ring, item T) bool {
	if ring < Ring0 || ring >= RingCount {
		return false
	}
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.closed {
		return false
	}
	select {
	case q.rings[ring] <- item:
		return true
	default:
		return false
	}
}

// PopBlocking 阻塞直到有任务到达，返回最高优先级环的任务。
// 队列关闭且已排空时返回 T 的零值。
func (q *RingQueue[T]) PopBlocking() T {
	var zero T
	for {
		// 从高环到低环非阻塞轮询，优先返回高环任务。
		for i := 0; i < RingCount; i++ {
			select {
			case item := <-q.rings[i]:
				return item
			default:
			}
		}
		// 所有环为空：检查是否已关闭。
		q.mu.Lock()
		closed := q.closed
		q.mu.Unlock()
		if closed {
			return zero
		}
		// 阻塞等待任意环或关闭信号。
		select {
		case item := <-q.rings[0]:
			return item
		case item := <-q.rings[1]:
			return item
		case item := <-q.rings[2]:
			return item
		case item := <-q.rings[3]:
			return item
		case <-q.closeCh:
			// 关闭：回到循环顶部，非阻塞排空已入队数据；全空后由 closed 分支返回零值。
		}
	}
}

// PopNonBlocking 非阻塞尝试获取最高优先级环的任务。
// ok 为 false 表示当前没有可用的任务。
func (q *RingQueue[T]) PopNonBlocking() (item T, ok bool) {
	for i := 0; i < RingCount; i++ {
		select {
		case item := <-q.rings[i]:
			return item, true
		default:
		}
	}
	var zero T
	return zero, false
}

// Peek 非阻塞查看最高非空环的层级；所有环为空时返回 NoRing（不消费任务）。
func (q *RingQueue[T]) Peek() int {
	for i := 0; i < RingCount; i++ {
		if len(q.rings[i]) > 0 {
			return i
		}
	}
	return NoRing
}

// Len 返回所有环的任务总数。
func (q *RingQueue[T]) Len() int {
	n := 0
	for i := 0; i < RingCount; i++ {
		n += len(q.rings[i])
	}
	return n
}

// RingLen 返回指定环的任务数。
func (q *RingQueue[T]) RingLen(ring Ring) int {
	if ring < Ring0 || ring >= RingCount {
		return 0
	}
	return len(q.rings[ring])
}

// Close 关闭队列。关闭后 Push 返回 false；已入队任务仍可被 Pop 排空。
// Close 可安全重复调用（幂等）。
func (q *RingQueue[T]) Close() {
	q.closeOnce.Do(func() {
		q.mu.Lock()
		q.closed = true
		q.mu.Unlock()
		close(q.closeCh)
	})
}
