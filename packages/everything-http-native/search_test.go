package everythinghttp

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
)

func TestSearchProjectsFileRowsAndPreservesProviderQuery(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		query := request.URL.Query()
		for _, key := range []string{"json", "path_column", "size_column", "date_modified_column", "date_created_column"} {
			if query.Get(key) != "1" {
				t.Fatalf("missing %s query flag: %v", key, query)
			}
		}
		if query.Get("search") != "*.png" || query.Get("count") != "1" || query.Get("o") != "2" {
			t.Fatalf("unexpected query: %v", query)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"results":[{"type":"folder","name":"ignored","path":"C:\\assets"},{"type":"file","name":"cover.PNG","path":"C:\\assets","size":"42","date_modified":"132537600000000000","date_created":"7"}],"totalResults":2,"totalFileResults":1}`))
	}))
	t.Cleanup(server.Close)
	host, portText, err := net.SplitHostPort(server.Listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.Atoi(portText)
	if err != nil {
		t.Fatal(err)
	}
	page, err := Search(context.Background(), SearchRequest{Host: host, Port: port, Search: "*.png", Offset: 2, Limit: 1}, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Assets) != 1 || page.Assets[0].Name != "cover.PNG" || page.Assets[0].Extension != ".png" {
		t.Fatalf("unexpected assets: %#v", page.Assets)
	}
	if page.Assets[0].Path != "C:/assets/cover.PNG" || page.TotalCount != 1 || page.Offset != 2 || page.Limit != 1 {
		t.Fatalf("unexpected page: %#v", page)
	}
}

func TestSearchRejectsMalformedResponseAndInvalidPage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		_, _ = writer.Write([]byte(`{"results":`))
	}))
	t.Cleanup(server.Close)
	host, portText, _ := net.SplitHostPort(server.Listener.Addr().String())
	port, _ := strconv.Atoi(portText)
	if _, err := Search(context.Background(), SearchRequest{Host: host, Port: port}, server.Client()); err == nil {
		t.Fatal("expected malformed response error")
	}
	if _, err := BuildURL(host, port, SearchRequest{Offset: -1}); err == nil {
		t.Fatal("expected negative offset error")
	}
}

func TestSearchReturnsCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := Search(ctx, SearchRequest{Host: "127.0.0.1", Port: 80}, http.DefaultClient)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation, got %v", err)
	}
}
