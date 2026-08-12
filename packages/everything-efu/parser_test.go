package everythingefu

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"
)

const fixture = "\ufeffFilename,Size,Date Modified,Date Created\nC:\\assets\\one.png,42,132537600000000000,7\nC:\\assets\\bad.txt,not-a-number,,\n"

func TestParseRetainsRowsAndAttachesFieldIssues(t *testing.T) {
	assets, issues, err := ParseBytes([]byte(fixture))
	if err != nil {
		t.Fatal(err)
	}
	if len(assets) != 2 || assets[0].Path != "C:/assets/one.png" || assets[0].Extension != ".png" {
		t.Fatalf("unexpected assets: %#v", assets)
	}
	if len(assets[1].Issues) != 1 || assets[1].Issues[0].Code != "invalid-size" || len(issues) != 0 {
		t.Fatalf("unexpected issues: assets=%#v page=%#v", assets[1].Issues, issues)
	}
}

func TestProviderUsesAuthorizedSourceAndPagesResults(t *testing.T) {
	var received SearchRequest
	provider := NewProvider(func(ctx context.Context, request SearchRequest) (io.ReadCloser, error) {
		received = request
		return io.NopCloser(strings.NewReader("Filename,Size\nC:\\a\\one.txt,1\nC:\\a\\two.txt,2\n")), nil
	})
	page, err := provider.Search(context.Background(), SearchRequest{RootID: "root-a", Path: "exports/list.EFU", Offset: 1, Limit: 1})
	if err != nil {
		t.Fatal(err)
	}
	if received.RootID != "root-a" || received.Path != "exports/list.EFU" || len(page.Assets) != 1 || page.Assets[0].Name != "two.txt" || page.HasMore {
		t.Fatalf("unexpected source/page: %#v %#v", received, page)
	}
	if _, err := provider.Search(context.Background(), SearchRequest{RootID: "root-a", Path: "exports/list.txt"}); !errors.Is(err, ErrInvalidRequest) {
		t.Fatalf("expected provider-owned extension validation, got %v", err)
	}
}

func TestProviderReturnsCancellationInsteadOfAnEmptyPage(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	provider := NewProvider(func(context.Context, SearchRequest) (io.ReadCloser, error) {
		cancel()
		return io.NopCloser(strings.NewReader("Filename\nC:\\a\\one.txt\n")), nil
	})
	_, err := provider.Search(ctx, SearchRequest{RootID: "root-a", Path: "list.efu"})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation, got %v", err)
	}
}
