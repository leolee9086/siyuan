package assets

import "testing"

func TestClassifyUsesTheSharedAssetFormatMatrix(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		media    string
		kind     PreviewKind
		provider ThumbnailProvider
	}{
		{name: "svg", path: "icons/mark.SVG", kind: PreviewKindImage, provider: ThumbnailProviderSVG},
		{name: "raster", path: "images/photo.webp", kind: PreviewKindImage, provider: ThumbnailProviderRaster},
		{name: "d5m", path: "models/scene.d5m", kind: PreviewKindBinary, provider: ThumbnailProviderD5M},
		{name: "pdf", path: "docs/readme.pdf", kind: PreviewKindPDF, provider: ThumbnailProviderSystem},
		{name: "audio mime", path: "recording.bin", media: "audio/ogg", kind: PreviewKindAudio, provider: ThumbnailProviderSystem},
		{name: "text", path: "source/file.ts", kind: PreviewKindText, provider: ThumbnailProviderNone},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := Classify(test.path, test.media)
			if got.PreviewKind != test.kind || got.ThumbnailProvider != test.provider {
				t.Fatalf("Classify(%q, %q) = %+v, want kind=%q provider=%q", test.path, test.media, got, test.kind, test.provider)
			}
		})
	}
}

func TestExtensionAcceptsAnExtensionValue(t *testing.T) {
	if got := Extension(".SVG"); got != ".svg" {
		t.Fatalf("Extension(.SVG) = %q", got)
	}
}
