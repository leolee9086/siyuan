package externalprovidercontract

import "strings"

const (
	SessionFieldTargetEndpoint   = "endpoint"
	SessionFieldTargetCredential = "credential"
	SessionFieldTargetOption     = "option"
)

const (
	SessionFieldInputText     = "text"
	SessionFieldInputPassword = "password"
	SessionFieldInputURL      = "url"
	SessionFieldInputCheckbox = "checkbox"
)

const EndpointTransportHTTPSOrConfirmedPrivateHTTP = "https-or-confirmed-private-http"

// SessionConfig 描述 provider 自己公开的连接输入。它只负责通用表单投影；
// 字段值和组合约束仍由 provider 在 ValidateSessionRequest 中解释。
type SessionConfig struct {
	Fields            []SessionField `json:"fields"`
	ReadOnly          bool           `json:"readOnly,omitempty"`
	EndpointTransport string         `json:"endpointTransport,omitempty"`
}

// SessionField 的 Target 决定值进入 endpoint、临时 credential payload 或
// provider-owned options。Descriptor 只含字段元数据，不含用户输入值。
type SessionField struct {
	Target       string   `json:"target"`
	Key          string   `json:"key"`
	Label        string   `json:"label"`
	Input        string   `json:"input"`
	Required     bool     `json:"required,omitempty"`
	RequiredWith []string `json:"requiredWith,omitempty"`
	Placeholder  string   `json:"placeholder,omitempty"`
	DefaultValue string   `json:"defaultValue,omitempty"`
	Autocomplete string   `json:"autocomplete,omitempty"`
}

func validateSessionConfig(config *SessionConfig) error {
	if config == nil || len(config.Fields) == 0 {
		return ErrInvalidRequest
	}
	seen := make(map[string]struct{}, len(config.Fields))
	keysByTarget := make(map[string]map[string]struct{})
	hasEndpoint := false
	for _, field := range config.Fields {
		target := strings.TrimSpace(field.Target)
		key := strings.TrimSpace(field.Key)
		if key == "" || strings.TrimSpace(field.Label) == "" || len(key) > MaxNameSize ||
			len(field.Label) > MaxNameSize || len(field.Placeholder) > MaxNameSize || len(field.DefaultValue) > MaxNameSize {
			return ErrInvalidRequest
		}
		switch target {
		case SessionFieldTargetEndpoint:
			if key != "endpoint" || hasEndpoint {
				return ErrInvalidRequest
			}
			hasEndpoint = true
		case SessionFieldTargetCredential, SessionFieldTargetOption:
		default:
			return ErrInvalidRequest
		}
		switch field.Input {
		case SessionFieldInputText, SessionFieldInputPassword, SessionFieldInputURL:
			if field.DefaultValue != "" && field.Input == SessionFieldInputPassword {
				return ErrInvalidRequest
			}
		case SessionFieldInputCheckbox:
			if field.Required || (field.DefaultValue != "" && field.DefaultValue != "true" && field.DefaultValue != "false") {
				return ErrInvalidRequest
			}
		default:
			return ErrInvalidRequest
		}
		identity := target + "\x00" + key
		if _, exists := seen[identity]; exists {
			return ErrInvalidRequest
		}
		seen[identity] = struct{}{}
		if keysByTarget[target] == nil {
			keysByTarget[target] = make(map[string]struct{})
		}
		keysByTarget[target][key] = struct{}{}
	}
	for _, field := range config.Fields {
		dependencies := make(map[string]struct{}, len(field.RequiredWith))
		for _, dependency := range field.RequiredWith {
			dependency = strings.TrimSpace(dependency)
			if dependency == "" || dependency == field.Key {
				return ErrInvalidRequest
			}
			if _, exists := keysByTarget[field.Target][dependency]; !exists {
				return ErrInvalidRequest
			}
			if _, exists := dependencies[dependency]; exists {
				return ErrInvalidRequest
			}
			dependencies[dependency] = struct{}{}
		}
	}
	if config.EndpointTransport != "" {
		if config.EndpointTransport != EndpointTransportHTTPSOrConfirmedPrivateHTTP || !hasEndpoint {
			return ErrInvalidRequest
		}
	}
	return nil
}
