package channel

// InboundMessage 通道无关的标准化入站消息。
type InboundMessage struct {
	ChannelID           string            `json:"channelId"`
	ChannelType         string            `json:"channelType"`
	AccountID           string            `json:"accountId"`
	UserID              string            `json:"userId"`
	Nickname            string            `json:"nickname,omitempty"`
	IdentityID          string            `json:"identityId,omitempty"`
	IdentityDisplayName string            `json:"identityDisplayName,omitempty"`
	Text                string            `json:"text,omitempty"`
	Media               []MediaAttachment `json:"media,omitempty"`
	ConversationToken   string            `json:"conversationToken,omitempty"`
	Timestamp           int64             `json:"timestamp"`
}

// OutboundMessage 通道无关的标准化出站消息。
type OutboundMessage struct {
	ChannelID           string            `json:"channelId"`
	ChannelType         string            `json:"channelType"`
	AccountID           string            `json:"accountId"`
	UserID              string            `json:"userId"`
	IdentityID          string            `json:"identityId,omitempty"`
	IdentityDisplayName string            `json:"identityDisplayName,omitempty"`
	Text                string            `json:"text,omitempty"`
	Media               []MediaAttachment `json:"media,omitempty"`
	ConversationToken   string            `json:"conversationToken,omitempty"`
}

// MediaAttachment 媒体附件。
type MediaAttachment struct {
	Type     MediaType `json:"type"`
	URL      string    `json:"url,omitempty"`
	MIMEType string    `json:"mimeType,omitempty"`
	FileName string    `json:"fileName,omitempty"`
	FileSize int64     `json:"fileSize,omitempty"`
}

type MediaType string

const (
	MediaTypeImage MediaType = "image"
	MediaTypeVideo MediaType = "video"
	MediaTypeAudio MediaType = "audio"
	MediaTypeFile  MediaType = "file"
)
