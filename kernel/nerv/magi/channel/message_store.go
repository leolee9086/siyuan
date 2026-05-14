package channel

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"path/filepath"
	"sync"
	"time"

	_ "github.com/siyuan-note/siyuan/kernel/sql"
	"github.com/siyuan-note/siyuan/kernel/util"
)

const defaultQueryLimit = 20
const maxQueryLimit = 200
const maxMessageTextLen = 65536
const maxNicknameLen = 256
const maxIDLen = 256

var (
	_msgStore   *MessageStore
	_msgStoreMu sync.RWMutex
)

// GlobalMessageStore 返回全局 MessageStore 实例。
func GlobalMessageStore() *MessageStore {
	_msgStoreMu.RLock()
	defer _msgStoreMu.RUnlock()
	return _msgStore
}

// InitMessageStore 初始化全局 MessageStore 并建表。
func InitMessageStore() error {
	_msgStoreMu.Lock()
	defer _msgStoreMu.Unlock()

	store := &MessageStore{}
	if err := store.init(); err != nil {
		return err
	}
	_msgStore = store
	return nil
}

// CloseMessageStore 关闭全局 MessageStore 的数据库连接。
func CloseMessageStore() {
	_msgStoreMu.Lock()
	defer _msgStoreMu.Unlock()
	if _msgStore != nil {
		_msgStore.close()
		_msgStore = nil
	}
}

// MessageStore 渠道消息 SQLite 持久化存储。
type MessageStore struct {
	mu       sync.RWMutex
	db       *sql.DB
	saveStmt *sql.Stmt
}

func (s *MessageStore) init() error {
	dbPath := filepath.Join(util.TempDir, "s-forge-channel-msgs.db")
	util.LogDatabaseSize(dbPath)

	dsn := dbPath + "?_journal_mode=WAL" +
		"&_synchronous=OFF" +
		"&_mmap_size=2684354560" +
		"&_secure_delete=OFF" +
		"&_cache_size=-20480" +
		"&_page_size=32768" +
		"&_busy_timeout=7000" +
		"&_ignore_check_constraints=ON" +
		"&_temp_store=MEMORY" +
		"&_case_sensitive_like=OFF"

	var err error
	s.db, err = sql.Open("sqlite3_extended", dsn)
	if err != nil {
		return fmt.Errorf("open channel message database: %w", err)
	}

	s.db.SetMaxIdleConns(5)
	s.db.SetMaxOpenConns(5)
	s.db.SetConnMaxLifetime(365 * 24 * time.Hour)

	if err := s.createTables(); err != nil {
		return err
	}

	s.saveStmt, err = s.db.Prepare(saveMessageSQL)
	if err != nil {
		return fmt.Errorf("prepare save statement: %w", err)
	}

	return nil
}

func (s *MessageStore) close() {
	if s.saveStmt != nil {
		s.saveStmt.Close()
	}
	if s.db != nil {
		s.db.Close()
	}
}

func (s *MessageStore) createTables() error {
	_, err := s.db.Exec(`
	CREATE TABLE IF NOT EXISTS channel_messages (
		id                    TEXT PRIMARY KEY,
		channel_id            TEXT NOT NULL,
		channel_type          TEXT NOT NULL DEFAULT '',
		account_id            TEXT NOT NULL,
		user_id               TEXT NOT NULL,
		nickname              TEXT DEFAULT '',
		identity_id           TEXT DEFAULT '',
		identity_display_name TEXT DEFAULT '',
		conversation_id       TEXT DEFAULT '',
		direction             TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
		content_type          TEXT NOT NULL CHECK(content_type IN (
			'text','image','video','audio','file','sticker','location',
			'contact','poll','rich_text','interactive','voice','system','mixed'
		)),
		created_at            INTEGER NOT NULL,
		edited_at             INTEGER DEFAULT 0,
		persisted_at          INTEGER NOT NULL,
		text_content          TEXT DEFAULT '',
		rich_body             TEXT DEFAULT '',
		media_json            TEXT DEFAULT '[]',
		reply_to_id           TEXT DEFAULT '',
		thread_id             TEXT DEFAULT '',
		mentions_json         TEXT DEFAULT '[]',
		reactions_json        TEXT DEFAULT '[]',
		location_json         TEXT DEFAULT '{}',
		contact_json          TEXT DEFAULT '{}',
		poll_json             TEXT DEFAULT '{}',
		sticker_json          TEXT DEFAULT '{}',
		interactive_json      TEXT DEFAULT '{}',
		voice_json            TEXT DEFAULT '{}',
		forward_info_json     TEXT DEFAULT '{}',
		is_edited             INTEGER DEFAULT 0,
		is_deleted            INTEGER DEFAULT 0,
		is_pinned             INTEGER DEFAULT 0,
		platform_meta_json    TEXT DEFAULT '{}'
	)`)
	if err != nil {
		return fmt.Errorf("create channel_messages table: %w", err)
	}

	for _, idx := range []string{
		`CREATE INDEX IF NOT EXISTS idx_cm_channel_time ON channel_messages(channel_id, account_id, persisted_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_cm_type_acct_time ON channel_messages(channel_type, account_id, persisted_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_cm_identity_time ON channel_messages(identity_id, persisted_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_cm_conv_time ON channel_messages(conversation_id, persisted_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_cm_user_time ON channel_messages(channel_id, account_id, user_id, persisted_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_cm_direction ON channel_messages(channel_id, account_id, direction, persisted_at DESC)`,
	} {
		if _, err := s.db.Exec(idx); err != nil {
			return fmt.Errorf("create index: %w", err)
		}
	}

	_, err = s.db.Exec(`
	CREATE TABLE IF NOT EXISTS channel_conversations (
		channel_id      TEXT NOT NULL,
		account_id      TEXT NOT NULL,
		conversation_id TEXT NOT NULL,
		total_count     INTEGER DEFAULT 0,
		oldest_at       INTEGER DEFAULT 0,
		newest_at       INTEGER DEFAULT 0,
		PRIMARY KEY (channel_id, account_id, conversation_id)
	)`)
	if err != nil {
		return fmt.Errorf("create channel_conversations table: %w", err)
	}

	return nil
}

const saveMessageSQL = `INSERT OR REPLACE INTO channel_messages (
	id, channel_id, channel_type, account_id, user_id, nickname,
	identity_id, identity_display_name, conversation_id,
	direction, content_type, created_at, edited_at, persisted_at,
	text_content, rich_body, media_json,
	reply_to_id, thread_id, mentions_json, reactions_json,
	location_json, contact_json, poll_json, sticker_json,
	interactive_json, voice_json, forward_info_json,
	is_edited, is_deleted, is_pinned, platform_meta_json
) VALUES (
	?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
)`

// SaveInbound 持久化一条入站消息（用户→MAGI）。
func (s *MessageStore) SaveInbound(ctx context.Context, msg *InboundMessage) error {
	return s.save(ctx, msg, nil)
}

// SaveOutbound 持久化一条出站消息（MAGI→用户）。
func (s *MessageStore) SaveOutbound(ctx context.Context, msg *OutboundMessage) error {
	return s.save(ctx, nil, msg)
}

func (s *MessageStore) save(ctx context.Context, inbound *InboundMessage, outbound *OutboundMessage) error {
	p, err := s.toPersisted(inbound, outbound)
	if err != nil {
		return fmt.Errorf("serialize message: %w", err)
	}

	mediaJSON := marshalToJSON(p.Media)
	mentionsJSON := marshalToJSON(p.Mentions)
	reactionsJSON := marshalToJSON(p.Reactions)
	locationJSON := marshalToJSON(p.Location)
	contactJSON := marshalToJSON(p.Contact)
	pollJSON := marshalToJSON(p.Poll)
	stickerJSON := marshalToJSON(p.Sticker)
	interactiveJSON := marshalToJSON(p.Interactive)
	voiceJSON := marshalToJSON(p.Voice)
	forwardInfoJSON := marshalToJSON(p.ForwardInfo)
	platformMetaJSON := jsonToRaw(p.PlatformMeta)

	isEdited := boolToInt(p.IsEdited)
	isDeleted := boolToInt(p.IsDeleted)
	isPinned := boolToInt(p.IsPinned)

	_, execErr := s.saveStmt.ExecContext(ctx,
		p.ID, p.ChannelID, p.ChannelType, p.AccountID, p.UserID, p.Nickname,
		p.IdentityID, p.IdentityDisplayName, p.ConversationID,
		string(p.Direction), string(p.ContentType), p.CreatedAt, p.EditedAt, p.PersistedAt,
		p.Text, p.RichBody, mediaJSON,
		p.ReplyToID, p.ThreadID, mentionsJSON, reactionsJSON,
		locationJSON, contactJSON, pollJSON, stickerJSON,
		interactiveJSON, voiceJSON, forwardInfoJSON,
		isEdited, isDeleted, isPinned, platformMetaJSON,
	)
	if execErr != nil {
		return fmt.Errorf("insert message: %w", execErr)
	}

	_ = s.upsertConversationMeta(ctx, p)
	return nil
}

func (s *MessageStore) toPersisted(inbound *InboundMessage, outbound *OutboundMessage) (*PersistedMessage, error) {
	p := &PersistedMessage{
		PersistedAt: time.Now().UnixMilli(),
	}

	if inbound != nil {
		p.ChannelID = truncateStr(inbound.ChannelID, maxIDLen)
		p.ChannelType = truncateStr(inbound.ChannelType, maxIDLen)
		p.AccountID = truncateStr(inbound.AccountID, maxIDLen)
		p.UserID = truncateStr(inbound.UserID, maxIDLen)
		p.Nickname = truncateStr(inbound.Nickname, maxNicknameLen)
		p.IdentityID = truncateStr(inbound.IdentityID, maxIDLen)
		p.IdentityDisplayName = truncateStr(inbound.IdentityDisplayName, maxNicknameLen)
		p.ConversationID = truncateStr(inbound.ConversationToken, maxIDLen)
		p.Direction = DirInbound
		p.CreatedAt = inbound.Timestamp
		p.Text = truncateStr(inbound.Text, maxMessageTextLen)
		p.Media = boundMedia(inbound.Media)
		p.ContentType = resolveContentType(inbound.Text, inbound.Media)

		raw, _ := json.Marshal(inbound)
		p.PlatformMeta = raw
		p.ID = generateMessageID(p.ChannelID, p.AccountID, "in", inbound.Timestamp)
	}

	if outbound != nil {
		p.ChannelID = truncateStr(outbound.ChannelID, maxIDLen)
		p.ChannelType = truncateStr(outbound.ChannelType, maxIDLen)
		p.AccountID = truncateStr(outbound.AccountID, maxIDLen)
		p.UserID = truncateStr(outbound.UserID, maxIDLen)
		p.ConversationID = truncateStr(outbound.ConversationToken, maxIDLen)
		p.Direction = DirOutbound
		p.CreatedAt = p.PersistedAt
		p.Text = truncateStr(outbound.Text, maxMessageTextLen)
		p.Media = boundMedia(outbound.Media)
		p.ContentType = resolveContentType(outbound.Text, outbound.Media)

		raw, _ := json.Marshal(outbound)
		p.PlatformMeta = raw
		p.ID = generateMessageID(p.ChannelID, p.AccountID, "out", p.PersistedAt)
	}

	return p, nil
}

func (s *MessageStore) upsertConversationMeta(ctx context.Context, p *PersistedMessage) error {
	if p.ConversationID == "" {
		return nil
	}
	_, err := s.db.ExecContext(ctx, `
	INSERT INTO channel_conversations (channel_id, account_id, conversation_id, total_count, oldest_at, newest_at)
	VALUES (?, ?, ?, 1, ?, ?)
	ON CONFLICT(channel_id, account_id, conversation_id) DO UPDATE SET
		total_count = total_count + 1,
		oldest_at = MIN(oldest_at, excluded.oldest_at),
		newest_at = MAX(newest_at, excluded.newest_at)
	`, p.ChannelID, p.AccountID, p.ConversationID, p.CreatedAt, p.CreatedAt)
	return err
}

// Query 查询消息，按时间倒序返回。
func (s *MessageStore) Query(ctx context.Context, opts QueryOptions) (*QueryResult, error) {
	if opts.Limit <= 0 {
		opts.Limit = defaultQueryLimit
	}
	if opts.Limit > maxQueryLimit {
		opts.Limit = maxQueryLimit
	}

	where := "WHERE channel_id = ? AND account_id = ?"
	args := []interface{}{opts.ChannelID, opts.AccountID}

	if opts.ChannelType != "" {
		where += " AND channel_type = ?"
		args = append(args, opts.ChannelType)
	}
	if opts.IdentityID != "" {
		where += " AND identity_id = ?"
		args = append(args, opts.IdentityID)
	}
	if opts.UserID != "" {
		where += " AND user_id = ?"
		args = append(args, opts.UserID)
	}
	if opts.Direction != "" {
		where += " AND direction = ?"
		args = append(args, string(opts.Direction))
	}
	if opts.Before > 0 {
		where += " AND persisted_at < ?"
		args = append(args, opts.Before)
	}
	if opts.After > 0 {
		where += " AND persisted_at > ?"
		args = append(args, opts.After)
	}

	countSQL := "SELECT COUNT(*) FROM channel_messages " + where
	var total int64
	if err := s.db.QueryRowContext(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count messages: %w", err)
	}

	querySQL := "SELECT " + messageSelectColumns + " FROM channel_messages " + where +
		" ORDER BY persisted_at DESC LIMIT ?"
	queryArgs := append(append([]interface{}{}, args...), opts.Limit)
	rows, err := s.db.QueryContext(ctx, querySQL, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("query messages: %w", err)
	}
	defer rows.Close()

	messages, err := scanMessages(rows)
	if err != nil {
		return nil, err
	}

	if messages == nil {
		messages = []PersistedMessage{}
	}

	hasMore := int64(len(messages)) < total
	var oldestAt, newestAt int64
	if len(messages) > 0 {
		newestAt = messages[0].PersistedAt
		oldestAt = messages[len(messages)-1].PersistedAt
	}

	return &QueryResult{
		Messages: messages,
		Total:    total,
		HasMore:  hasMore,
		OldestAt: oldestAt,
		NewestAt: newestAt,
	}, nil
}

const messageSelectColumns = `
	id, channel_id, channel_type, account_id, user_id, nickname,
	identity_id, identity_display_name, conversation_id,
	direction, content_type, created_at, edited_at, persisted_at,
	text_content, rich_body, media_json,
	reply_to_id, thread_id, mentions_json, reactions_json,
	location_json, contact_json, poll_json, sticker_json,
	interactive_json, voice_json, forward_info_json,
	is_edited, is_deleted, is_pinned, platform_meta_json
`

func scanMessages(rows *sql.Rows) ([]PersistedMessage, error) {
	var messages []PersistedMessage
	for rows.Next() {
		var m PersistedMessage
		var mediaJSON, mentionsJSON, reactionsJSON string
		var locationJSON, contactJSON, pollJSON, stickerJSON string
		var interactiveJSON, voiceJSON, forwardInfoJSON string
		var platformMetaJSON string

		if err := rows.Scan(
			&m.ID, &m.ChannelID, &m.ChannelType, &m.AccountID, &m.UserID, &m.Nickname,
			&m.IdentityID, &m.IdentityDisplayName, &m.ConversationID,
			&m.Direction, &m.ContentType, &m.CreatedAt, &m.EditedAt, &m.PersistedAt,
			&m.Text, &m.RichBody, &mediaJSON,
			&m.ReplyToID, &m.ThreadID, &mentionsJSON, &reactionsJSON,
			&locationJSON, &contactJSON, &pollJSON, &stickerJSON,
			&interactiveJSON, &voiceJSON, &forwardInfoJSON,
			&m.IsEdited, &m.IsDeleted, &m.IsPinned, &platformMetaJSON,
		); err != nil {
			return nil, fmt.Errorf("scan message: %w", err)
		}

		json.Unmarshal([]byte(mediaJSON), &m.Media)
		json.Unmarshal([]byte(mentionsJSON), &m.Mentions)
		json.Unmarshal([]byte(reactionsJSON), &m.Reactions)
		unmarshalJSONOrNil([]byte(locationJSON), &m.Location)
		unmarshalJSONOrNil([]byte(contactJSON), &m.Contact)
		unmarshalJSONOrNil([]byte(pollJSON), &m.Poll)
		unmarshalJSONOrNil([]byte(stickerJSON), &m.Sticker)
		unmarshalJSONOrNil([]byte(interactiveJSON), &m.Interactive)
		unmarshalJSONOrNil([]byte(voiceJSON), &m.Voice)
		unmarshalJSONOrNil([]byte(forwardInfoJSON), &m.ForwardInfo)
		if platformMetaJSON != "" && platformMetaJSON != "null" && platformMetaJSON != "{}" {
			m.PlatformMeta = json.RawMessage(platformMetaJSON)
		}

		messages = append(messages, m)
	}
	return messages, rows.Err()
}

func resolveContentType(text string, media []MediaAttachment) MessageContentType {
	hasText := text != ""
	hasMedia := len(media) > 0

	if hasText && hasMedia {
		return ContentMixed
	}
	if hasText {
		return ContentText
	}
	if hasMedia {
		switch media[0].Type {
		case MediaTypeImage:
			return ContentImage
		case MediaTypeVideo:
			return ContentVideo
		case MediaTypeAudio:
			return ContentAudio
		case MediaTypeFile:
			return ContentFile
		}
	}
	return ContentText
}

func generateMessageID(channelID, accountID, dir string, ts int64) string {
	b := make([]byte, 6)
	rand.Read(b)
	return fmt.Sprintf("%s-%s-%s-%d-%s", channelID, accountID, dir, ts, hex.EncodeToString(b))
}

func marshalToJSON(v interface{}) string {
	if v == nil {
		return "[]"
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return "[]"
	}
	return string(raw)
}

func jsonToRaw(v json.RawMessage) string {
	if len(v) == 0 {
		return "{}"
	}
	return string(v)
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func unmarshalJSONOrNil(data []byte, v interface{}) {
	if len(data) == 0 || string(data) == "null" || string(data) == "{}" || string(data) == "[]" {
		return
	}
	json.Unmarshal(data, v)
}

func truncateStr(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen]
}

func boundMedia(media []MediaAttachment) []MediaAttachment {
	const maxMedia = 20
	if len(media) <= maxMedia {
		return media
	}
	return media[:maxMedia]
}
