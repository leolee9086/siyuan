package webdavprovider

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"

	webdav "github.com/emersion/go-webdav"
	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type davClient struct {
	client *webdav.Client
}

func newDAVClient(httpClient *http.Client, endpoint string, credentials Credentials) (Client, error) {
	authClient := webdav.HTTPClient(httpClient)
	if credentials.Username != "" || credentials.Password != "" {
		authClient = webdav.HTTPClientWithBasicAuth(httpClient, credentials.Username, credentials.Password)
	}
	client, err := webdav.NewClient(authClient, endpoint)
	if err != nil {
		return nil, err
	}
	return &davClient{client: client}, nil
}

func (c *davClient) Stat(ctx context.Context, path string) (*FileInfo, error) {
	info, err := c.client.Stat(ctx, path)
	if err != nil {
		return nil, err
	}
	return convertFileInfo(info), nil
}

func (c *davClient) ReadDir(ctx context.Context, path string, recursive bool) ([]FileInfo, error) {
	infos, err := c.client.ReadDir(ctx, path, recursive)
	if err != nil {
		return nil, err
	}
	result := make([]FileInfo, 0, len(infos))
	for index := range infos {
		result = append(result, *convertFileInfo(&infos[index]))
	}
	return result, nil
}

func (c *davClient) Open(ctx context.Context, path string) (io.ReadCloser, error) {
	return c.client.Open(ctx, path)
}

func (c *davClient) Create(ctx context.Context, path string) (io.WriteCloser, error) {
	return c.client.Create(ctx, path)
}

func (c *davClient) Mkdir(ctx context.Context, path string) error {
	return c.client.Mkdir(ctx, path)
}

func (c *davClient) RemoveAll(ctx context.Context, path string) error {
	return c.client.RemoveAll(ctx, path)
}

func (c *davClient) Copy(ctx context.Context, source, destination string, overwrite bool) error {
	return c.client.Copy(ctx, source, destination, &webdav.CopyOptions{NoOverwrite: !overwrite})
}

func (c *davClient) Move(ctx context.Context, source, destination string, overwrite bool) error {
	return c.client.Move(ctx, source, destination, &webdav.MoveOptions{NoOverwrite: !overwrite})
}

func convertFileInfo(info *webdav.FileInfo) *FileInfo {
	if info == nil {
		return nil
	}
	return &FileInfo{
		Path:      info.Path,
		Size:      info.Size,
		ModTime:   info.ModTime,
		IsDir:     info.IsDir,
		MediaType: info.MIMEType,
		ETag:      info.ETag,
	}
}

func safeHTTPClient(source *http.Client) *http.Client {
	copyClient := *source
	previous := copyClient.CheckRedirect
	copyClient.CheckRedirect = func(request *http.Request, via []*http.Request) error {
		if err := externalprovider.ValidateEndpointRedirect(request, via); err != nil {
			return errors.Join(ErrInvalidEndpoint, err)
		}
		if previous != nil {
			return previous(request, via)
		}
		return nil
	}
	return &copyClient
}

func validateEndpoint(endpoint string, allowInsecure bool) (*url.URL, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return nil, invalidEndpoint(nil)
	}
	u, err := url.Parse(endpoint)
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return nil, invalidEndpoint(err)
	}
	if u.Scheme != "https" && u.Scheme != "http" {
		return nil, invalidEndpoint(nil)
	}
	if err = externalprovider.ValidateEndpointTransport(u, allowInsecure); err != nil {
		return nil, invalidEndpoint(err)
	}
	if u.Path == "" {
		u.Path = "/"
	}
	return u, nil
}
