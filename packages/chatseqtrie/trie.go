package chatseqtrie

import (
	"sync"
	"sync/atomic"
)

// MatchResult 前缀匹配结果。
//
// 由 Insert 或 Match 返回，描述输入序列与已存储序列的关系。
type MatchResult struct {
	// MatchedSession 最长的「完整前缀匹配」对应的会话 ID。
	// 即：已存储的某条序列恰好是输入序列的前缀，该序列的 session ID。
	// 为空表示没有任何已存序列是输入的完整前缀。
	MatchedSession string `json:"matchedSession"`

	// MatchedLen 匹配到的前缀长度（消息条数）。
	// 若 MatchedSession 非空，此值等于该 session 的序列长度。
	// 若 MatchedSession 为空，此值为 0。
	MatchedLen int `json:"matchedLen"`

	// CommonPrefixLen 输入序列与已有路径的共同前缀长度。
	// 在此位置之前，输入的每条消息都在树中找到了匹配的子节点。
	// 在此位置之后（或输入结束时），要么分叉，要么输入耗尽。
	// 始终 >= MatchedLen。
	CommonPrefixLen int `json:"commonPrefixLen"`

	// Suffix 新增消息：输入中需要被处理的部分。
	// 若 MatchedSession 非空：suffix = input[matchedLen:]（session 终点之后的所有消息）。
	// 若 MatchedSession 为空：suffix = input[commonPrefixLen:]（分叉点之后的所有消息）。
	// 若输入完全匹配某已存序列且无新增：suffix 为空切片。
	Suffix []Message `json:"suffix"`

	// IsExactMatch 输入是否精确匹配某个已存序列（suffix 为空且 MatchedSession 非空）。
	IsExactMatch bool `json:"isExactMatch"`

	// IsVariant 输入是否在某个位置创建了新分支（分叉）。
	IsVariant bool `json:"isVariant"`

	// BranchPoint 分叉位置索引（输入序列中的位置）。
	// -1 表示无分叉（输入完全沿已有路径走完）。
	BranchPoint int `json:"branchPoint"`

	// PathSessions 匹配路径上经过的所有 session ID（按深度排序）。
	// 用于调用方判断变体继承关系。
	PathSessions []string `json:"pathSessions,omitempty"`
}

// trieNode 前缀树内部节点。
type trieNode struct {
	keyJSON  string               // 内容字段的 JSON 字符串（用于匹配）
	keyHash  string               // keyJSON 的 SHA-256 十六进制摘要（用于存储键）
	document Message              // 完整消息文档（含修饰字段）
	children map[string]*trieNode // keyJSON → 子节点
	sessions map[string]bool      // 以此节点为终点的 session ID 集合
	parent   *trieNode            // 父节点（用于向上遍历）
	depth    int                  // 从根开始的深度（根 = 0）
	nodeID   int64                // 持久化节点 ID（0 = 未分配）
}

// Trie 聊天序列前缀树。
//
// 核心操作：
//   - Insert：插入一条消息序列，返回与已有序列的匹配关系
//   - Match：查找最长前缀匹配（不插入）
//   - Remove：移除一个会话及其可能产生的死分支
//   - FindVariants：查找与指定会话共享前缀的所有变体会话
type Trie struct {
	mu      sync.RWMutex
	root    *trieNode
	policy  *FieldPolicy
	storage Storage          // 可选的持久化存储后端
	nextID  atomic.Int64     // 下一个节点 ID

	// sessionToNode 维护 sessionID → 终节点的映射，用于：
	//   1. 同一 sessionID 重复 Insert 不同路径时，清理旧标记
	//   2. 快速按 sessionID 反查消息序列
	//   3. Remove 时无需全树遍历即可定位目标节点
	sessionToNode map[string]*trieNode
}

// Option Trie 构造选项。
type Option func(*Trie)

// WithFieldPolicy 设置字段策略。
func WithFieldPolicy(p *FieldPolicy) Option {
	return func(t *Trie) {
		t.policy = p
	}
}

// WithStorage 设置持久化存储后端。
func WithStorage(s Storage) Option {
	return func(t *Trie) {
		t.storage = s
	}
}

// New 创建前缀树。
func New(opts ...Option) *Trie {
	t := &Trie{
		root: &trieNode{
			children: make(map[string]*trieNode),
			sessions: make(map[string]bool),
			depth:    0,
			nodeID:   0,
		},
		policy: DefaultFieldPolicy(),
	}
	t.sessionToNode = make(map[string]*trieNode)
	for _, opt := range opts {
		opt(t)
	}
	t.nextID.Store(1)
	return t
}

// computeKey 计算消息的内容键（线程安全读取策略）。
func (t *Trie) computeKey(msg Message) (string, string, error) {
	keyJSON, err := t.policy.ComputeKey(msg)
	if err != nil {
		return "", "", err
	}
	keyHash, err := t.policy.ComputeKeyHash(msg)
	if err != nil {
		return "", "", err
	}
	return keyJSON, keyHash, nil
}

// Insert 插入一条消息序列，返回与已有序列的匹配关系。
//
// 流程：
//  1. 从根开始逐条消息匹配内容键
//  2. 跟踪路径上最后一个 session 标记
//  3. 遇到不匹配的消息时创建新分支
//  4. 走完后在终节点标记 session ID
func (t *Trie) Insert(sessionID string, messages []Message) (*MatchResult, error) {
	if len(messages) == 0 {
		return &MatchResult{BranchPoint: -1}, nil
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	current := t.root
	lastSessionEnd := -1
	lastSessionID := ""
	var pathSessions []string
	commonPrefixLen := 0

	for i := 0; i < len(messages); i++ {
		keyJSON, _, err := t.computeKey(messages[i])
		if err != nil {
			return nil, err
		}

		child, exists := current.children[keyJSON]
		if !exists {
			// 分叉：从此处开始创建新节点
			commonPrefixLen = i
			for j := i; j < len(messages); j++ {
				jKeyJSON, jKeyHash, err := t.computeKey(messages[j])
				if err != nil {
					return nil, err
				}
				child = &trieNode{
					keyJSON:  jKeyJSON,
					keyHash:  jKeyHash,
					document: messages[j],
					children: make(map[string]*trieNode),
					sessions: make(map[string]bool),
					parent:   current,
					depth:    current.depth + 1,
					nodeID:   t.nextID.Add(1),
				}
				current.children[jKeyJSON] = child
				current = child

				// 若配置了存储，写入存储
				if t.storage != nil {
					if err := t.storage.PutNode(&StoredNode{
						ID:       current.nodeID,
						ParentID: current.parent.nodeID,
						KeyHash:  jKeyHash,
						KeyJSON:  jKeyJSON,
						Document: messages[j],
						Depth:    current.depth,
					}); err != nil {
						// 存储失败不阻断内存操作，仅记录
						continue
					}
				}
			}
			// 跳到终节点标记 session
			break
		}

		current = child
		commonPrefixLen = i + 1

		// 检查此节点上是否有 session 标记
		if len(current.sessions) > 0 {
			for sid := range current.sessions {
				lastSessionID = sid
				lastSessionEnd = i
				pathSessions = append(pathSessions, sid)
			}
		}
	}

	// 标记终节点前，清理同一 sessionID 的旧标记（如果此次路径变了）
	if oldNode, hasOld := t.sessionToNode[sessionID]; hasOld && oldNode != current {
		delete(oldNode.sessions, sessionID)
		if t.storage != nil {
			_ = t.storage.RemoveSession(oldNode.nodeID, sessionID)
		}
	}
	if current.sessions == nil {
		current.sessions = make(map[string]bool)
	}
	current.sessions[sessionID] = true
	t.sessionToNode[sessionID] = current

	if t.storage != nil {
		_ = t.storage.MarkSession(current.nodeID, sessionID)
	}

	// 计算匹配结果
	matchedLen := 0
	matchedSession := ""
	if lastSessionEnd >= 0 {
		matchedSession = lastSessionID
		matchedLen = lastSessionEnd + 1
	}

	// 计算后缀
	var suffix []Message
	if matchedLen > 0 {
		suffix = messages[matchedLen:]
	} else if commonPrefixLen > 0 && commonPrefixLen < len(messages) {
		suffix = messages[commonPrefixLen:]
	} else if commonPrefixLen == 0 {
		suffix = messages
	}

	// 判断是否精确匹配：输入长度等于匹配到的 session 长度
	isExact := matchedLen > 0 && matchedLen == len(messages)

	// 判断是否为变体
	isVariant := commonPrefixLen < len(messages)

	branchPoint := -1
	if isVariant {
		branchPoint = commonPrefixLen
	}

	return &MatchResult{
		MatchedSession:  matchedSession,
		MatchedLen:      matchedLen,
		CommonPrefixLen: commonPrefixLen,
		Suffix:          suffix,
		IsExactMatch:    isExact,
		IsVariant:       isVariant,
		BranchPoint:     branchPoint,
		PathSessions:    pathSessions,
	}, nil
}

// Match 查找最长前缀匹配，不插入任何内容。
func (t *Trie) Match(messages []Message) (*MatchResult, error) {
	if len(messages) == 0 {
		return &MatchResult{BranchPoint: -1}, nil
	}

	t.mu.RLock()
	defer t.mu.RUnlock()

	current := t.root
	lastSessionEnd := -1
	lastSessionID := ""
	var pathSessions []string
	commonPrefixLen := 0

	for i := 0; i < len(messages); i++ {
		keyJSON, _, err := t.computeKey(messages[i])
		if err != nil {
			return nil, err
		}

		child, exists := current.children[keyJSON]
		if !exists {
			commonPrefixLen = i
			break
		}

		current = child
		commonPrefixLen = i + 1

		if len(current.sessions) > 0 {
			for sid := range current.sessions {
				lastSessionID = sid
				lastSessionEnd = i
				pathSessions = append(pathSessions, sid)
			}
		}
	}

	matchedLen := 0
	matchedSession := ""
	if lastSessionEnd >= 0 {
		matchedSession = lastSessionID
		matchedLen = lastSessionEnd + 1
	}

	var suffix []Message
	if matchedLen > 0 {
		suffix = messages[matchedLen:]
	} else if commonPrefixLen > 0 && commonPrefixLen < len(messages) {
		suffix = messages[commonPrefixLen:]
	} else if commonPrefixLen == 0 {
		suffix = messages
	}

	isVariant := commonPrefixLen < len(messages)
	branchPoint := -1
	if isVariant {
		branchPoint = commonPrefixLen
	}

	return &MatchResult{
		MatchedSession:  matchedSession,
		MatchedLen:      matchedLen,
		CommonPrefixLen: commonPrefixLen,
		Suffix:          suffix,
		IsExactMatch:    matchedLen > 0 && matchedLen == len(messages),
		IsVariant:       isVariant,
		BranchPoint:     branchPoint,
		PathSessions:    pathSessions,
	}, nil
}

// Remove 移除一个会话标记。不删除节点本身（其他会话可能共享路径）。
// 返回是否找到并移除了该会话。
func (t *Trie) Remove(sessionID string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()

	// 先查映射表快速定位旧节点
	if oldNode, hasOld := t.sessionToNode[sessionID]; hasOld {
		delete(oldNode.sessions, sessionID)
		delete(t.sessionToNode, sessionID)
		if t.storage != nil {
			_ = t.storage.RemoveSession(oldNode.nodeID, sessionID)
		}
		return true
	}

	// 映射表未命中时回退到全树遍历
	removed := false
	var walk func(n *trieNode)
	walk = func(n *trieNode) {
		if n.sessions[sessionID] {
			delete(n.sessions, sessionID)
			removed = true
			delete(t.sessionToNode, sessionID)
			if t.storage != nil {
				_ = t.storage.RemoveSession(n.nodeID, sessionID)
			}
		}
		for _, child := range n.children {
			walk(child)
		}
	}
	walk(t.root)
	return removed
}

// FindVariants 查找与指定会话共享前缀的所有其他会话。
//
// 返回的 map 为：sessionID → 共享前缀长度。
// 不包含 sessionID 自身。
func (t *Trie) FindVariants(sessionID string) map[string]int {
	t.mu.RLock()
	defer t.mu.RUnlock()

	result := make(map[string]int)

	// 先找到 sessionID 的终节点，记录路径
	var targetPath []*trieNode
	var findPath func(n *trieNode) bool
	findPath = func(n *trieNode) bool {
		if n.sessions[sessionID] {
			return true
		}
		for _, child := range n.children {
			if findPath(child) {
				targetPath = append([]*trieNode{child}, targetPath...)
				return true
			}
		}
		return false
	}
	findPath(t.root)
	targetPath = append([]*trieNode{t.root}, targetPath...)

	// 沿路径收集 session 标记（其他 session 在路径节点上的标记）
	for depth, node := range targetPath {
		for sid := range node.sessions {
			if sid != sessionID {
				result[sid] = depth
			}
		}
	}

	// 检查路径上每个节点的兄弟分支（不在路径上的子节点）
	// 这些分支在深度 i+1 处与目标路径分叉，共享前缀长度为 i（i 条消息相同）
	for i := 0; i < len(targetPath)-1; i++ {
		nextOnPath := targetPath[i+1]
		for _, child := range targetPath[i].children {
			if child != nextOnPath {
				collectSessionsInSubtree(child, i, result, sessionID)
			}
		}
	}

	// 检查终节点之后的延伸分支
	// 延伸分支中的 session 共享前缀长度 = 终节点的深度（目标的完整路径是其前缀）
	if len(targetPath) > 0 {
		endNode := targetPath[len(targetPath)-1]
		endDepth := len(targetPath) - 1
		collectExtensions(endNode, endDepth, result, sessionID)
	}

	return result
}

// collectSessionsInSubtree 递归收集子树中的所有 session，记录共享前缀深度。
// 用于兄弟分支：分叉点之后的所有 session 共享前缀长度 = 分叉深度。
func collectSessionsInSubtree(n *trieNode, sharedDepth int, result map[string]int, excludeSession string) {
	for sid := range n.sessions {
		if sid != excludeSession {
			if _, exists := result[sid]; !exists {
				result[sid] = sharedDepth
			}
		}
	}
	for _, child := range n.children {
		collectSessionsInSubtree(child, sharedDepth, result, excludeSession)
	}
}

// collectExtensions 递归收集延伸分支中的所有 session。
// 延伸分支的 session 共享前缀长度 = 目标终节点的深度（目标的完整路径是其前缀）。
func collectExtensions(n *trieNode, sharedDepth int, result map[string]int, excludeSession string) {
	for _, child := range n.children {
		for sid := range child.sessions {
			if sid != excludeSession {
				if _, exists := result[sid]; !exists {
					result[sid] = sharedDepth
				}
			}
		}
		collectExtensions(child, sharedDepth, result, excludeSession)
	}
}

// SessionCount 返回树中已注册的会话总数。
func (t *Trie) SessionCount() int {
	t.mu.RLock()
	defer t.mu.RUnlock()

	count := 0
	var walk func(n *trieNode)
	walk = func(n *trieNode) {
		count += len(n.sessions)
		for _, child := range n.children {
			walk(child)
		}
	}
	walk(t.root)
	return count
}

// NodeCount 返回树中节点总数（不含根节点）。
func (t *Trie) NodeCount() int {
	t.mu.RLock()
	defer t.mu.RUnlock()

	count := 0
	var walk func(n *trieNode)
	walk = func(n *trieNode) {
		count += len(n.children)
		for _, child := range n.children {
			walk(child)
		}
	}
	walk(t.root)
	return count
}
