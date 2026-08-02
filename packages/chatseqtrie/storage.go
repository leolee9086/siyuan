package chatseqtrie

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	bolt "go.etcd.io/bbolt"
)

// Storage 持久化存储后端接口。
//
// 实现方负责节点存储、session 标记管理和子节点遍历。
// 核心查询模式：按父节点 ID + 内容键哈希查找子节点（前缀匹配的核心操作）。
type Storage interface {
	// GetNode 按父节点 ID 和内容键哈希查找子节点。
	GetNode(parentID int64, keyHash string) (*StoredNode, error)

	// PutNode 存储一个节点。若已存在则覆盖。
	PutNode(node *StoredNode) error

	// MarkSession 在指定节点上标记一个 session。
	MarkSession(nodeID int64, sessionID string) error

	// RemoveSession 移除指定节点上的 session 标记。
	RemoveSession(nodeID int64, sessionID string) error

	// GetSessions 返回指定节点上的所有 session ID。
	GetSessions(nodeID int64) ([]string, error)

	// WalkChildren 遍历指定父节点的所有子节点。
	WalkChildren(parentID int64, fn func(*StoredNode) error) error

	// LoadAll 加载全部节点和 session，用于启动时重建内存树。
	LoadAll() (*TrieData, error)

	// Close 关闭存储。
	Close() error
}

// StoredNode 持久化存储的节点结构。
type StoredNode struct {
	ID       int64   `json:"id"`       // 节点 ID（0 = 根节点）
	ParentID int64   `json:"parentId"` // 父节点 ID
	KeyHash  string  `json:"keyHash"`  // 内容键的 SHA-256 十六进制摘要
	KeyJSON  string  `json:"keyJson"`  // 内容键 JSON（调试用）
	Document Message `json:"document"` // 完整消息文档
	Depth    int     `json:"depth"`    // 从根开始的深度
}

// TrieData 全量树数据，用于加载/保存。
type TrieData struct {
	Nodes    []StoredNode `json:"nodes"`
	Sessions []SessionEntry `json:"sessions"`
}

// SessionEntry session 标记记录。
type SessionEntry struct {
	NodeID    int64  `json:"nodeId"`
	SessionID string `json:"sessionId"`
}

// BoltStorage 基于 bbolt 的持久化存储实现。
//
// 存储布局：
//   - bucket "nodes"：key = [parentID uint64 BE][keyHash]，value = JSON(StoredNode)
//   - bucket "sessions"：key = [nodeID uint64 BE][sessionID]，value = 空
//   - bucket "meta"：元数据（字段策略等）
//
// 同父节点的子节点在 B+ 树中连续存储，范围扫描高效。
type BoltStorage struct {
	db   *bolt.DB
	path string
	mu   sync.Mutex // 串行化写事务（bbolt 单写者模型）
}

// NewBoltStorage 打开或创建 bbolt 存储。
func NewBoltStorage(path string) (*BoltStorage, error) {
	db, err := bolt.Open(path, 0600, &bolt.Options{Timeout: 1 * time.Second})
	if err != nil {
		return nil, fmt.Errorf("打开 bbolt 存储失败: %w", err)
	}

	// 初始化 bucket
	err = db.Update(func(tx *bolt.Tx) error {
		for _, name := range []string{"nodes", "sessions", "meta"} {
			if _, err := tx.CreateBucketIfNotExists([]byte(name)); err != nil {
				return fmt.Errorf("创建 bucket %s 失败: %w", name, err)
			}
		}
		return nil
	})
	if err != nil {
		db.Close()
		return nil, err
	}

	return &BoltStorage{db: db, path: path}, nil
}

// Close 关闭存储。
func (s *BoltStorage) Close() error {
	return s.db.Close()
}

// nodeKey 构造节点存储键：[parentID uint64 BE][keyHash]。
func nodeKey(parentID int64, keyHash string) []byte {
	buf := make([]byte, 8+len(keyHash))
	binary.BigEndian.PutUint64(buf, uint64(parentID))
	copy(buf[8:], keyHash)
	return buf
}

// sessionKey 构造 session 存储键：[nodeID uint64 BE][sessionID]。
func sessionKey(nodeID int64, sessionID string) []byte {
	buf := make([]byte, 8+len(sessionID))
	binary.BigEndian.PutUint64(buf, uint64(nodeID))
	copy(buf[8:], sessionID)
	return buf
}

// parseNodeParentID 从节点存储键中解析父节点 ID。
func parseNodeParentID(key []byte) int64 {
	if len(key) < 8 {
		return -1
	}
	return int64(binary.BigEndian.Uint64(key[:8]))
}

// parseSessionNodeID 从 session 存储键中解析节点 ID。
func parseSessionNodeID(key []byte) int64 {
	if len(key) < 8 {
		return -1
	}
	return int64(binary.BigEndian.Uint64(key[:8]))
}

// parseSessionID 从 session 存储键中解析 session ID。
func parseSessionID(key []byte) string {
	if len(key) <= 8 {
		return ""
	}
	return string(key[8:])
}

// GetNode 按父节点 ID 和内容键哈希查找子节点。
func (s *BoltStorage) GetNode(parentID int64, keyHash string) (*StoredNode, error) {
	var node *StoredNode
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte("nodes"))
		if bucket == nil {
			return fmt.Errorf("nodes bucket 不存在")
		}
		data := bucket.Get(nodeKey(parentID, keyHash))
		if data == nil {
			return nil // 未找到
		}
		node = &StoredNode{}
		return json.Unmarshal(data, node)
	})
	return node, err
}

// PutNode 存储一个节点。
func (s *BoltStorage) PutNode(node *StoredNode) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte("nodes"))
		if bucket == nil {
			return fmt.Errorf("nodes bucket 不存在")
		}
		data, err := json.Marshal(node)
		if err != nil {
			return fmt.Errorf("序列化节点失败: %w", err)
		}
		return bucket.Put(nodeKey(node.ParentID, node.KeyHash), data)
	})
}

// MarkSession 在指定节点上标记一个 session。
func (s *BoltStorage) MarkSession(nodeID int64, sessionID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte("sessions"))
		if bucket == nil {
			return fmt.Errorf("sessions bucket 不存在")
		}
		return bucket.Put(sessionKey(nodeID, sessionID), []byte{})
	})
}

// RemoveSession 移除指定节点上的 session 标记。
func (s *BoltStorage) RemoveSession(nodeID int64, sessionID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte("sessions"))
		if bucket == nil {
			return fmt.Errorf("sessions bucket 不存在")
		}
		return bucket.Delete(sessionKey(nodeID, sessionID))
	})
}

// GetSessions 返回指定节点上的所有 session ID。
func (s *BoltStorage) GetSessions(nodeID int64) ([]string, error) {
	var sessions []string
	prefix := make([]byte, 8)
	binary.BigEndian.PutUint64(prefix, uint64(nodeID))

	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte("sessions"))
		if bucket == nil {
			return fmt.Errorf("sessions bucket 不存在")
		}
		cursor := bucket.Cursor()
		for k, _ := cursor.Seek(prefix); k != nil; k, _ = cursor.Next() {
			if len(k) < 8 || binary.BigEndian.Uint64(k[:8]) != uint64(nodeID) {
				break
			}
			sessions = append(sessions, parseSessionID(k))
		}
		return nil
	})
	return sessions, err
}

// WalkChildren 遍历指定父节点的所有子节点。
func (s *BoltStorage) WalkChildren(parentID int64, fn func(*StoredNode) error) error {
	prefix := make([]byte, 8)
	binary.BigEndian.PutUint64(prefix, uint64(parentID))

	return s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte("nodes"))
		if bucket == nil {
			return fmt.Errorf("nodes bucket 不存在")
		}
		cursor := bucket.Cursor()
		for k, v := cursor.Seek(prefix); k != nil; k, v = cursor.Next() {
			if len(k) < 8 || binary.BigEndian.Uint64(k[:8]) != uint64(parentID) {
				break
			}
			node := &StoredNode{}
			if err := json.Unmarshal(v, node); err != nil {
				continue
			}
			if err := fn(node); err != nil {
				return err
			}
		}
		return nil
	})
}

// LoadAll 加载全部节点和 session，用于启动时重建内存树。
func (s *BoltStorage) LoadAll() (*TrieData, error) {
	data := &TrieData{}

	// 加载所有节点
	err := s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte("nodes"))
		if bucket == nil {
			return nil
		}
		return bucket.ForEach(func(k, v []byte) error {
			node := &StoredNode{}
			if err := json.Unmarshal(v, node); err != nil {
				return nil // 跳过无法解析的节点
			}
			data.Nodes = append(data.Nodes, *node)
			return nil
		})
	})
	if err != nil {
		return nil, err
	}

	// 加载所有 session
	err = s.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte("sessions"))
		if bucket == nil {
			return nil
		}
		return bucket.ForEach(func(k, _ []byte) error {
			nodeID := parseSessionNodeID(k)
			sessionID := parseSessionID(k)
			data.Sessions = append(data.Sessions, SessionEntry{
				NodeID:    nodeID,
				SessionID: sessionID,
			})
			return nil
		})
	})
	if err != nil {
		return nil, err
	}

	return data, nil
}

// LoadFromStorage 从持久化存储重建内存树。
// 调用方应在 New() 之后、使用 Insert 之前调用此方法。
func (t *Trie) LoadFromStorage() error {
	if t.storage == nil {
		return fmt.Errorf("未配置存储后端")
	}

	data, err := t.storage.LoadAll()
	if err != nil {
		return fmt.Errorf("加载存储数据失败: %w", err)
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	// 构建 nodeID → trieNode 映射
	nodeMap := make(map[int64]*trieNode)
	nodeMap[0] = t.root // 根节点 ID = 0

	// 第一遍：创建所有节点
	for _, sn := range data.Nodes {
		node := &trieNode{
			keyJSON:  sn.KeyJSON,
			keyHash:  sn.KeyHash,
			document: sn.Document,
			children: make(map[string]*trieNode),
			sessions: make(map[string]bool),
			depth:    sn.Depth,
			nodeID:   sn.ID,
		}
		nodeMap[sn.ID] = node

		// 更新 nextID
		if sn.ID >= t.nextID.Load() {
			t.nextID.Store(sn.ID + 1)
		}
	}

	// 第二遍：建立父子关系
	for _, sn := range data.Nodes {
		node := nodeMap[sn.ID]
		if parent, ok := nodeMap[sn.ParentID]; ok {
			parent.children[sn.KeyJSON] = node
			node.parent = parent
		}
	}

	// 第三遍：恢复 session 标记（sessions map + sessionOrder 稳定迭代序，
	// 两者必须同时恢复——Match/Insert 依赖 sessionOrder 遍历 session，
	// 只恢复 map 会导致 MatchedSession 恒为空）。
	for _, se := range data.Sessions {
		if node, ok := nodeMap[se.NodeID]; ok {
			if !node.sessions[se.SessionID] {
				node.sessionOrder = append(node.sessionOrder, se.SessionID)
			}
			node.sessions[se.SessionID] = true
		}
	}

	// 第四遍：填充 sessionToNode 映射表，确保重启后 Insert 可清理旧标记
	for _, se := range data.Sessions {
		if node, ok := nodeMap[se.NodeID]; ok {
			t.sessionToNode[se.SessionID] = node
		}
	}

	return nil
}
