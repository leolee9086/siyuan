package windowssmbmount

import (
	"crypto/sha256"
	"encoding/base64"
	"path/filepath"
	"sort"
	"strings"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type mountSpec struct {
	id      externalprovider.ResourceID
	host    string
	share   string
	root    string
	aliases []externalprovider.ResourceAlias
}

func normalizeMounts(mounts []Mount) ([]mountSpec, error) {
	byRoot := make(map[string]*mountSpec, len(mounts))
	for _, mount := range mounts {
		host, share, root, err := parseUNC(mount.RemoteName)
		if err != nil {
			return nil, err
		}
		key := strings.ToLower(root)
		spec := byRoot[key]
		if spec == nil {
			spec = &mountSpec{id: resourceID(host, share), host: host, share: share, root: root}
			byRoot[key] = spec
		}
		if alias := normalizeLocalAlias(mount.LocalName); alias != "" {
			spec.aliases = appendUniqueAlias(spec.aliases, externalprovider.ResourceAlias{Kind: "mapped-drive", Label: alias})
		}
	}
	result := make([]mountSpec, 0, len(byRoot))
	for _, spec := range byRoot {
		sort.Slice(spec.aliases, func(left, right int) bool { return spec.aliases[left].Label < spec.aliases[right].Label })
		result = append(result, *spec)
	}
	sort.Slice(result, func(left, right int) bool {
		if strings.EqualFold(result[left].host, result[right].host) {
			return strings.ToLower(result[left].share) < strings.ToLower(result[right].share)
		}
		return strings.ToLower(result[left].host) < strings.ToLower(result[right].host)
	})
	return result, nil
}

func parseUNC(value string) (host, share, root string, err error) {
	value = strings.TrimSpace(strings.ReplaceAll(value, "/", `\`))
	if !strings.HasPrefix(value, `\\`) || strings.IndexByte(value, 0) >= 0 {
		return "", "", "", ErrInvalidEndpoint
	}
	parts := strings.FieldsFunc(strings.TrimPrefix(value, `\\`), func(r rune) bool { return r == '\\' })
	if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[1]) == "" {
		return "", "", "", ErrInvalidEndpoint
	}
	host = strings.TrimSpace(parts[0])
	share = strings.TrimSpace(parts[1])
	root = `\\` + host + `\` + share
	return host, share, root, nil
}

func normalizeLocalAlias(value string) string {
	value = strings.ToUpper(strings.TrimSpace(value))
	if len(value) == 1 && value[0] >= 'A' && value[0] <= 'Z' {
		return value + ":"
	}
	if len(value) == 2 && value[0] >= 'A' && value[0] <= 'Z' && value[1] == ':' {
		return value
	}
	return ""
}

func appendUniqueAlias(aliases []externalprovider.ResourceAlias, value externalprovider.ResourceAlias) []externalprovider.ResourceAlias {
	for _, alias := range aliases {
		if alias.Kind == value.Kind && strings.EqualFold(alias.Label, value.Label) {
			return aliases
		}
	}
	return append(aliases, value)
}

func resourceID(host, share string) externalprovider.ResourceID {
	digest := sha256.Sum256([]byte(strings.ToLower(host) + "\x00" + strings.ToLower(share)))
	return externalprovider.ResourceID("share-" + base64.RawURLEncoding.EncodeToString(digest[:12]))
}

func sourceDescriptor(host string) externalprovider.SourceDescriptor {
	return externalprovider.SourceDescriptor{Name: host, Kind: "smb-host"}
}

func normalizeRelativePath(value string) (string, error) {
	if strings.IndexByte(value, 0) >= 0 || filepath.IsAbs(value) || strings.HasPrefix(value, `\`) || strings.HasPrefix(value, "/") {
		return "", externalprovider.ErrInvalidRequest
	}
	value = strings.ReplaceAll(value, `\`, "/")
	parts := strings.Split(value, "/")
	clean := make([]string, 0, len(parts))
	for _, part := range parts {
		switch part {
		case "", ".":
			continue
		case "..":
			return "", externalprovider.ErrInvalidRequest
		default:
			clean = append(clean, part)
		}
	}
	return strings.Join(clean, "/"), nil
}
