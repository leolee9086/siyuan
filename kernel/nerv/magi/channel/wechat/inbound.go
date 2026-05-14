package wechat

import (
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel"
)

// convertToInbound 将 weixinMessage 转换为通用的 InboundMessage。
// 如果消息没有有效内容，返回 nil。
func convertToInbound(channelID, accountID string, wxMsg *weixinMessage) *channel.InboundMessage {
	if wxMsg == nil || wxMsg.FromUserID == "" {
		return nil
	}

	msg := &channel.InboundMessage{
		ChannelID:         channelID,
		ChannelType:       "wechat",
		AccountID:         accountID,
		UserID:            wxMsg.FromUserID,
		ConversationToken: wxMsg.ContextToken,
		Timestamp:         wxMsg.CreateTimeMs,
	}

	if wxMsg.ItemList == nil {
		return msg
	}

	for _, item := range wxMsg.ItemList {
		switch item.Type {
		case messageItemTypeText:
			if item.TextItem != nil && strings.TrimSpace(item.TextItem.Text) != "" {
				msg.Text += item.TextItem.Text
			}
		case messageItemTypeImage:
			if item.ImageItem != nil {
				media := channel.MediaAttachment{
					Type: channel.MediaTypeImage,
				}
				if item.ImageItem.URL != "" {
					media.URL = item.ImageItem.URL
				}
				msg.Media = append(msg.Media, media)
			}
		case messageItemTypeVoice:
			if item.VoiceItem != nil {
				media := channel.MediaAttachment{
					Type: channel.MediaTypeAudio,
				}
				msg.Media = append(msg.Media, media)
				if item.VoiceItem.Text != "" {
					msg.Text += item.VoiceItem.Text
				}
			}
		case messageItemTypeFile:
			if item.FileItem != nil {
				media := channel.MediaAttachment{
					Type:     channel.MediaTypeFile,
					FileName: item.FileItem.FileName,
					FileSize: parseFileLen(item.FileItem.Len),
				}
				msg.Media = append(msg.Media, media)
			}
		case messageItemTypeVideo:
			if item.VideoItem != nil {
				media := channel.MediaAttachment{
					Type: channel.MediaTypeVideo,
				}
				msg.Media = append(msg.Media, media)
			}
		}
	}

	return msg
}

func parseFileLen(s string) int64 {
	if s == "" {
		return 0
	}
	var n int64
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + int64(c-'0')
		}
	}
	return n
}
