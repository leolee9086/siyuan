package assets

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"strings"
	"sync"

	d5a "github.com/siyuan-note/siyuan/packages/d5a-viewer/native"
)

var ErrPreviewProviderNotFound = errors.New("asset preview provider not found")

// PreviewPayload is the format-domain result consumed by filebrowser. The
// loader owns format parsing; filebrowser owns root authorization and HTTP.
type PreviewPayload struct {
	Provider  string
	MediaType string
	Data      json.RawMessage
}

type PreviewLoader interface {
	ID() string
	Supports(extension string) bool
	Load(path string) (PreviewPayload, error)
}

type d5aPreviewLoader struct{}

func (d5aPreviewLoader) ID() string { return "d5a" }

func (d5aPreviewLoader) Supports(extension string) bool {
	extension = strings.ToLower(strings.TrimSpace(extension))
	return extension == ".d5a" || extension == ".d5mesh"
}

func (d5aPreviewLoader) Load(path string) (PreviewPayload, error) {
	extension := strings.ToLower(filepath.Ext(path))
	var report []byte
	var err error
	if extension == ".d5mesh" {
		report, err = d5a.InspectD5MeshJSON(path)
	} else if extension == ".d5a" {
		report, err = d5a.InspectFileJSON(path)
	} else {
		return PreviewPayload{}, ErrPreviewProviderNotFound
	}
	if err != nil {
		return PreviewPayload{}, err
	}
	return PreviewPayload{Provider: "d5a", MediaType: "application/json", Data: json.RawMessage(report)}, nil
}

var previewRegistry = struct {
	sync.RWMutex
	loaders []PreviewLoader
}{loaders: []PreviewLoader{d5aPreviewLoader{}}}

func RegisterPreviewLoader(loader PreviewLoader) error {
	if loader == nil || strings.TrimSpace(loader.ID()) == "" {
		return ErrPreviewProviderNotFound
	}
	previewRegistry.Lock()
	defer previewRegistry.Unlock()
	for _, existing := range previewRegistry.loaders {
		if existing.ID() == loader.ID() {
			return errors.New("asset preview provider already registered")
		}
	}
	previewRegistry.loaders = append(previewRegistry.loaders, loader)
	return nil
}

func LoadPreview(path string) (PreviewPayload, error) {
	extension := Extension(path)
	previewRegistry.RLock()
	loaders := append([]PreviewLoader(nil), previewRegistry.loaders...)
	previewRegistry.RUnlock()
	for _, loader := range loaders {
		if !loader.Supports(extension) {
			continue
		}
		return loader.Load(path)
	}
	return PreviewPayload{}, ErrPreviewProviderNotFound
}
