package channel

import "encoding/json"

// MessageDirection 消息方向
type MessageDirection string

const (
	DirInbound  MessageDirection = "inbound"
	DirOutbound MessageDirection = "outbound"
)

// MessageContentType 消息内容主类型 — 覆盖所有主流 IM 平台
type MessageContentType string

const (
	ContentText        MessageContentType = "text"
	ContentImage       MessageContentType = "image"
	ContentVideo       MessageContentType = "video"
	ContentAudio       MessageContentType = "audio"
	ContentFile        MessageContentType = "file"
	ContentSticker     MessageContentType = "sticker"
	ContentLocation    MessageContentType = "location"
	ContentContact     MessageContentType = "contact"
	ContentPoll        MessageContentType = "poll"
	ContentRichText    MessageContentType = "rich_text"
	ContentInteractive MessageContentType = "interactive"
	ContentVoice       MessageContentType = "voice"
	ContentSystem      MessageContentType = "system"
	ContentMixed       MessageContentType = "mixed"
)

// PersistedMessage 统一的渠道消息落盘记录 — 所有主流 IM 消息格式的超集。
// 每条记录对应一条入站或出站消息。
type PersistedMessage struct {
	ID                  string             `json:"id"`
	ChannelID           string             `json:"channelId"`
	ChannelType         string             `json:"channelType"`
	AccountID           string             `json:"accountId"`
	UserID              string             `json:"userId"`
	Nickname            string             `json:"nickname,omitempty"`
	IdentityID          string             `json:"identityId,omitempty"`
	IdentityDisplayName string             `json:"identityDisplayName,omitempty"`
	ConversationID      string             `json:"conversationId,omitempty"`
	Direction           MessageDirection   `json:"direction"`
	ContentType         MessageContentType `json:"contentType"`
	CreatedAt           int64              `json:"createdAt"`
	EditedAt            int64              `json:"editedAt,omitempty"`
	PersistedAt         int64              `json:"persistedAt"`
	Text                string             `json:"text,omitempty"`
	RichBody            string             `json:"richBody,omitempty"`
	Media               []MediaAttachment  `json:"media,omitempty"`
	ReplyToID           string             `json:"replyToId,omitempty"`
	ThreadID            string             `json:"threadId,omitempty"`
	Mentions            []Mention          `json:"mentions,omitempty"`
	Reactions           []Reaction         `json:"reactions,omitempty"`
	Location            *Location          `json:"location,omitempty"`
	Contact             *SharedContact     `json:"contact,omitempty"`
	Poll                *Poll              `json:"poll,omitempty"`
	Sticker             *StickerInfo       `json:"sticker,omitempty"`
	Interactive         *Interactive       `json:"interactive,omitempty"`
	Voice               *VoiceInfo         `json:"voice,omitempty"`
	ForwardInfo         *ForwardInfo       `json:"forwardInfo,omitempty"`
	IsEdited            bool               `json:"isEdited"`
	IsDeleted           bool               `json:"isDeleted"`
	IsPinned            bool               `json:"isPinned,omitempty"`
	PlatformMeta        json.RawMessage    `json:"platformMeta,omitempty"`
}

// Mention @提及
type Mention struct {
	UserID   string `json:"userId"`
	Nickname string `json:"nickname,omitempty"`
	Type     string `json:"type,omitempty"`
}

// Reaction 表情反应
type Reaction struct {
	Emoji string   `json:"emoji"`
	Count int      `json:"count"`
	Users []string `json:"users,omitempty"`
}

// Location 地理位置
type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Title     string  `json:"title,omitempty"`
	Address   string  `json:"address,omitempty"`
}

// SharedContact 共享联系人名片
type SharedContact struct {
	Name        string `json:"name,omitempty"`
	PhoneNumber string `json:"phoneNumber,omitempty"`
	UserID      string `json:"userId,omitempty"`
}

// Poll 投票
type Poll struct {
	Question string     `json:"question"`
	Options  []PollOption `json:"options"`
	IsClosed bool       `json:"isClosed,omitempty"`
}

// PollOption 投票选项
type PollOption struct {
	Text  string `json:"text"`
	Count int    `json:"count"`
}

// StickerInfo 表情包/贴纸
type StickerInfo struct {
	ID       string `json:"id"`
	Emoji    string `json:"emoji,omitempty"`
	SetName  string `json:"setName,omitempty"`
	FileID   string `json:"fileId,omitempty"`
}

// Interactive 交互组件
type Interactive struct {
	Type    string          `json:"type"` // button_reply / list_reply / card
	Payload json.RawMessage `json:"payload,omitempty"`
}

// VoiceInfo 语音消息扩展信息
type VoiceInfo struct {
	DurationSec int    `json:"durationSec,omitempty"`
	Transcript  string `json:"transcript,omitempty"`
	MIMEType    string `json:"mimeType,omitempty"`
}

// ForwardInfo 转发来源信息
type ForwardInfo struct {
	ChannelID string `json:"channelId,omitempty"`
	UserID    string `json:"userId,omitempty"`
	Nickname  string `json:"nickname,omitempty"`
	MessageID string `json:"messageId,omitempty"`
}

// QueryOptions 消息查询参数
type QueryOptions struct {
	ChannelID   string
	ChannelType string
	AccountID   string
	UserID      string
	IdentityID  string
	Direction   MessageDirection
	Limit       int
	Before      int64
	After       int64
}

// QueryResult 消息查询结果
type QueryResult struct {
	Messages []PersistedMessage `json:"messages"`
	Total    int64              `json:"total"`
	HasMore  bool               `json:"hasMore"`
	OldestAt int64              `json:"oldestAt,omitempty"`
	NewestAt int64              `json:"newestAt,omitempty"`
}
