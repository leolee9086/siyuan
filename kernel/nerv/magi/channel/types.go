package channel

// InboundMessage 通道无关的标准化入站消息。
type InboundMessage struct {
	ChannelID         string            `json:"channelId"`
	AccountID         string            `json:"accountId"`
	UserID            string            `json:"userId"`
	Nickname          string            `json:"nickname,omitempty"`
	Text              string            `json:"text,omitempty"`
	Media             []MediaAttachment `json:"media,omitempty"`
	ConversationToken string            `json:"conversationToken,omitempty"`
	Timestamp         int64             `json:"timestamp"`
}

// OutboundMessage 通道无关的标准化出站消息。
type OutboundMessage struct {
	ChannelID         string            `json:"channelId"`
	AccountID         string            `json:"accountId"`
	UserID            string            `json:"userId"`
	Text              string            `json:"text,omitempty"`
	Media             []MediaAttachment `json:"media,omitempty"`
	ConversationToken string            `json:"conversationToken,omitempty"`
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
