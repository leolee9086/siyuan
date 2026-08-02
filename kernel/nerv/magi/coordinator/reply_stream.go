package coordinator

import (
	"fmt"
	"sort"
	"strings"
	"unicode/utf16"
	"unicode/utf8"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
)

type replyToolStreamProjector struct {
	observer ReplyStreamObserver
	segments map[int]string
	emitted  string
}

func newReplyToolStreamProjector(observer ReplyStreamObserver) *replyToolStreamProjector {
	return &replyToolStreamProjector{
		observer: observer,
		segments: map[int]string{},
	}
}

func (p *replyToolStreamProjector) update(index int, toolName, rawArguments string) error {
	if p == nil || strings.TrimSpace(toolName) != config.WannaSpeakContinueToolName {
		return nil
	}
	content, found, err := decodePartialJSONStringField(rawArguments, "content")
	if err != nil {
		return fmt.Errorf("stream %s arguments: %w", config.WannaSpeakContinueToolName, err)
	}
	if !found {
		return nil
	}
	if previous := p.segments[index]; !strings.HasPrefix(content, previous) {
		return fmt.Errorf("stream %s content changed after emission", config.WannaSpeakContinueToolName)
	}
	p.segments[index] = content

	indexes := make([]int, 0, len(p.segments))
	for segmentIndex := range p.segments {
		indexes = append(indexes, segmentIndex)
	}
	sort.Ints(indexes)
	var combined strings.Builder
	for _, segmentIndex := range indexes {
		combined.WriteString(p.segments[segmentIndex])
	}
	// The final MAGI reply trims the joined tool segments. Applying the same
	// normalization to each cumulative snapshot also withholds trailing spacing
	// until later content determines whether it is significant.
	cumulative := strings.TrimSpace(combined.String())
	if cumulative == p.emitted {
		return nil
	}
	if !strings.HasPrefix(cumulative, p.emitted) {
		return fmt.Errorf("MAGI public reply stream is not append-only")
	}
	if p.observer != nil {
		if err := p.observer(cumulative); err != nil {
			return fmt.Errorf("forward MAGI public reply: %w", err)
		}
	}
	p.emitted = cumulative
	return nil
}

func (p *replyToolStreamProjector) current() string {
	if p == nil {
		return ""
	}
	return p.emitted
}

// decodePartialJSONStringField decodes the complete prefix currently available
// for a JSON string field. Incomplete UTF-8 and escape sequences are retained
// until the next tool-call delta arrives.
func decodePartialJSONStringField(raw, field string) (content string, found bool, err error) {
	valueStart, found, err := findJSONStringFieldValue(raw, field)
	if err != nil || !found {
		return "", found, err
	}
	decoded, _, err := decodePartialJSONString(raw[valueStart:])
	return decoded, true, err
}

func findJSONStringFieldValue(raw, field string) (valueStart int, found bool, err error) {
	for index := 0; index < len(raw); {
		if raw[index] != '"' {
			index++
			continue
		}
		key, next, complete, scanErr := decodeJSONStringToken(raw, index)
		if scanErr != nil {
			return 0, false, scanErr
		}
		if !complete {
			return 0, false, nil
		}
		index = next
		for index < len(raw) && isJSONWhitespace(raw[index]) {
			index++
		}
		if key != field || index >= len(raw) || raw[index] != ':' {
			continue
		}
		index++
		for index < len(raw) && isJSONWhitespace(raw[index]) {
			index++
		}
		if index >= len(raw) {
			return 0, false, nil
		}
		if raw[index] != '"' {
			return 0, false, fmt.Errorf("field %q must be a JSON string", field)
		}
		return index + 1, true, nil
	}
	return 0, false, nil
}

func decodeJSONStringToken(raw string, quoteIndex int) (decoded string, next int, complete bool, err error) {
	if quoteIndex >= len(raw) || raw[quoteIndex] != '"' {
		return "", quoteIndex, false, fmt.Errorf("JSON string must start with a quote")
	}
	decoded, complete, consumed, err := decodePartialJSONStringWithLength(raw[quoteIndex+1:])
	return decoded, quoteIndex + 1 + consumed, complete, err
}

func decodePartialJSONString(raw string) (decoded string, complete bool, err error) {
	decoded, complete, _, err = decodePartialJSONStringWithLength(raw)
	return
}

func decodePartialJSONStringWithLength(raw string) (decoded string, complete bool, consumed int, err error) {
	var result strings.Builder
	for index := 0; index < len(raw); {
		current := raw[index]
		if current == '"' {
			return result.String(), true, index + 1, nil
		}
		if current < 0x20 {
			return "", false, index, fmt.Errorf("unescaped control character in JSON string")
		}
		if current != '\\' {
			r, size := utf8.DecodeRuneInString(raw[index:])
			if r == utf8.RuneError && size == 1 {
				if !utf8.FullRuneInString(raw[index:]) {
					return result.String(), false, index, nil
				}
				return "", false, index, fmt.Errorf("invalid UTF-8 in JSON string")
			}
			result.WriteRune(r)
			index += size
			continue
		}

		if index+1 >= len(raw) {
			return result.String(), false, index, nil
		}
		escape := raw[index+1]
		switch escape {
		case '"', '\\', '/':
			result.WriteByte(escape)
			index += 2
		case 'b':
			result.WriteByte('\b')
			index += 2
		case 'f':
			result.WriteByte('\f')
			index += 2
		case 'n':
			result.WriteByte('\n')
			index += 2
		case 'r':
			result.WriteByte('\r')
			index += 2
		case 't':
			result.WriteByte('\t')
			index += 2
		case 'u':
			first, nextIndex, available, parseErr := decodeJSONHexRune(raw, index)
			if parseErr != nil {
				return "", false, index, parseErr
			}
			if !available {
				return result.String(), false, index, nil
			}
			if utf16.IsSurrogate(first) {
				if first < 0xD800 || first > 0xDBFF {
					return "", false, index, fmt.Errorf("unexpected low surrogate in JSON string")
				}
				second, afterSecond, secondAvailable, secondErr := decodeJSONHexRune(raw, nextIndex)
				if secondErr != nil {
					return "", false, index, secondErr
				}
				if !secondAvailable {
					return result.String(), false, index, nil
				}
				decodedRune := utf16.DecodeRune(first, second)
				if decodedRune == utf8.RuneError {
					return "", false, index, fmt.Errorf("invalid surrogate pair in JSON string")
				}
				result.WriteRune(decodedRune)
				index = afterSecond
				continue
			}
			result.WriteRune(first)
			index = nextIndex
		default:
			return "", false, index, fmt.Errorf("invalid JSON escape \\%c", escape)
		}
	}
	return result.String(), false, len(raw), nil
}

func decodeJSONHexRune(raw string, slashIndex int) (rune, int, bool, error) {
	if slashIndex+2 > len(raw) || raw[slashIndex] != '\\' {
		return 0, slashIndex, false, nil
	}
	if raw[slashIndex+1] != 'u' {
		return 0, slashIndex, false, fmt.Errorf("expected Unicode escape in JSON string")
	}
	if slashIndex+6 > len(raw) {
		return 0, slashIndex, false, nil
	}
	var value rune
	for _, digit := range raw[slashIndex+2 : slashIndex+6] {
		value <<= 4
		switch {
		case digit >= '0' && digit <= '9':
			value += digit - '0'
		case digit >= 'a' && digit <= 'f':
			value += digit - 'a' + 10
		case digit >= 'A' && digit <= 'F':
			value += digit - 'A' + 10
		default:
			return 0, slashIndex, false, fmt.Errorf("invalid Unicode escape in JSON string")
		}
	}
	return value, slashIndex + 6, true, nil
}

func isJSONWhitespace(value byte) bool {
	return value == ' ' || value == '\t' || value == '\r' || value == '\n'
}
