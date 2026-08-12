package s3provider

import (
	"context"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	awss3 "github.com/aws/aws-sdk-go-v2/service/s3"
	awss3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"
	smithyhttp "github.com/aws/smithy-go/transport/http"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type awsStore struct {
	client *awss3.Client
}

func newAWSStore(ctx context.Context, endpoint string, credentialsValue Credentials, config Config) (ObjectStore, error) {
	if _, err := validateEndpoint(endpoint, config.AllowInsecureHTTP); err != nil {
		return nil, err
	}
	region := config.Region
	if region == "" {
		region = "us-east-1"
	}
	loadOptions := []func(*awsconfig.LoadOptions) error{
		awsconfig.WithRegion(region),
	}
	httpClient := safeHTTPClient(config.HTTPClient)
	loadOptions = append(loadOptions, awsconfig.WithHTTPClient(httpClient))
	if credentialsValue.AccessKey != "" || credentialsValue.SecretKey != "" || credentialsValue.SessionToken != "" {
		loadOptions = append(loadOptions, awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			credentialsValue.AccessKey,
			credentialsValue.SecretKey,
			credentialsValue.SessionToken,
		)))
	}
	loadOptions = append(loadOptions, awsconfig.WithBaseEndpoint(endpoint))
	awsConfig, err := awsconfig.LoadDefaultConfig(ctx, loadOptions...)
	if err != nil {
		return nil, unavailable(err)
	}
	client := awss3.NewFromConfig(awsConfig, func(options *awss3.Options) {
		options.UsePathStyle = config.PathStyle
	})
	return &awsStore{client: client}, nil
}

func safeHTTPClient(source *http.Client) *http.Client {
	if source == nil {
		source = http.DefaultClient
	}
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

func (s *awsStore) ListBuckets(ctx context.Context, cursor string, limit int) (BucketPage, error) {
	output, err := s.client.ListBuckets(ctx, &awss3.ListBucketsInput{})
	if err != nil {
		return BucketPage{}, mapAWSError(err)
	}
	buckets := make([]BucketInfo, 0, len(output.Buckets))
	for _, bucket := range output.Buckets {
		if bucket.Name == nil {
			continue
		}
		created := time.Time{}
		if bucket.CreationDate != nil {
			created = *bucket.CreationDate
		}
		buckets = append(buckets, BucketInfo{Name: *bucket.Name, CreatedAt: created})
	}
	start, err := decodeCursor(cursor)
	if err != nil {
		return BucketPage{}, err
	}
	if start > len(buckets) {
		start = len(buckets)
	}
	end := start + limit
	if end > len(buckets) {
		end = len(buckets)
	}
	page := BucketPage{Buckets: buckets[start:end], HasMore: end < len(buckets)}
	if page.HasMore {
		page.NextCursor = encodeCursor(end)
	}
	return page, nil
}

func (s *awsStore) ListObjects(ctx context.Context, bucket, prefix, delimiter, cursor string, limit int) (ObjectPage, error) {
	input := &awss3.ListObjectsV2Input{Bucket: aws.String(bucket), Prefix: aws.String(prefix), MaxKeys: aws.Int32(int32(limit))}
	if delimiter != "" {
		input.Delimiter = aws.String(delimiter)
	}
	if cursor != "" {
		input.ContinuationToken = aws.String(cursor)
	}
	output, err := s.client.ListObjectsV2(ctx, input)
	if err != nil {
		return ObjectPage{}, mapAWSError(err)
	}
	page := ObjectPage{Objects: make([]ObjectInfo, 0, len(output.Contents)), Prefixes: make([]string, 0, len(output.CommonPrefixes))}
	for _, item := range output.Contents {
		if item.Key == nil {
			continue
		}
		page.Objects = append(page.Objects, objectFromSDK(item))
	}
	for _, item := range output.CommonPrefixes {
		if item.Prefix != nil {
			page.Prefixes = append(page.Prefixes, *item.Prefix)
		}
	}
	page.HasMore = output.IsTruncated != nil && *output.IsTruncated
	if page.HasMore && output.NextContinuationToken != nil {
		page.NextCursor = *output.NextContinuationToken
	}
	return page, nil
}

func (s *awsStore) StatObject(ctx context.Context, bucket, key string, preconditions externalprovider.Preconditions) (ObjectInfo, error) {
	input := &awss3.HeadObjectInput{Bucket: aws.String(bucket), Key: aws.String(key)}
	applyHeadPreconditions(input, preconditions)
	output, err := s.client.HeadObject(ctx, input)
	if err != nil {
		return ObjectInfo{}, mapAWSError(err)
	}
	return objectFromHead(output, key), nil
}

func (s *awsStore) OpenObject(ctx context.Context, bucket, key string, byteRange *externalprovider.ByteRange, preconditions externalprovider.Preconditions) (io.ReadCloser, ObjectInfo, error) {
	input := &awss3.GetObjectInput{Bucket: aws.String(bucket), Key: aws.String(key)}
	applyGetPreconditions(input, preconditions)
	if byteRange != nil {
		if err := externalprovider.ValidateByteRange(byteRange); err != nil {
			return nil, ObjectInfo{}, err
		}
		rangeValue := "bytes=" + strconv.FormatInt(byteRange.Start, 10) + "-"
		if byteRange.End > 0 {
			rangeValue = "bytes=" + strconv.FormatInt(byteRange.Start, 10) + "-" + strconv.FormatInt(byteRange.End, 10)
		}
		input.Range = aws.String(rangeValue)
	}
	output, err := s.client.GetObject(ctx, input)
	if err != nil {
		return nil, ObjectInfo{}, mapAWSError(err)
	}
	return output.Body, objectFromGet(output, key), nil
}

func (s *awsStore) PutObject(ctx context.Context, bucket, key string, body io.Reader, size int64, mediaType string, metadata map[string]string, preconditions externalprovider.Preconditions) (ObjectInfo, error) {
	input := &awss3.PutObjectInput{Bucket: aws.String(bucket), Key: aws.String(key), Body: body, Metadata: metadata}
	if size >= 0 {
		input.ContentLength = aws.Int64(size)
	}
	if mediaType != "" {
		input.ContentType = aws.String(mediaType)
	}
	if preconditions.IfMatch != "" {
		input.IfMatch = aws.String(preconditions.IfMatch)
	}
	if preconditions.IfNoneMatch != "" {
		input.IfNoneMatch = aws.String(preconditions.IfNoneMatch)
	}
	output, err := s.client.PutObject(ctx, input)
	if err != nil {
		return ObjectInfo{}, mapAWSError(err)
	}
	info := ObjectInfo{Key: key, Size: size, MediaType: mediaType, Metadata: metadata}
	if output.ETag != nil {
		info.ETag = *output.ETag
	}
	if output.VersionId != nil {
		info.VersionID = *output.VersionId
	}
	return info, nil
}

func (s *awsStore) DeleteObject(ctx context.Context, bucket, key string, recursive bool, preconditions externalprovider.Preconditions) error {
	if recursive {
		cursor := ""
		for {
			page, err := s.ListObjects(ctx, bucket, key, "", cursor, 1000)
			if err != nil {
				return err
			}
			for _, object := range page.Objects {
				if err := s.deleteOne(ctx, bucket, object.Key, preconditions); err != nil {
					return err
				}
			}
			if !page.HasMore {
				break
			}
			cursor = page.NextCursor
		}
		return nil
	}
	return s.deleteOne(ctx, bucket, key, preconditions)
}

func (s *awsStore) deleteOne(ctx context.Context, bucket, key string, preconditions externalprovider.Preconditions) error {
	input := &awss3.DeleteObjectInput{Bucket: aws.String(bucket), Key: aws.String(key)}
	if preconditions.VersionID != "" {
		input.VersionId = aws.String(preconditions.VersionID)
	}
	if preconditions.IfMatch != "" {
		input.IfMatch = aws.String(preconditions.IfMatch)
	}
	_, err := s.client.DeleteObject(ctx, input)
	if err != nil {
		return mapAWSError(err)
	}
	return nil
}

func (s *awsStore) CopyObject(ctx context.Context, sourceBucket, sourceKey, destinationBucket, destinationKey string, overwrite bool, preconditions externalprovider.Preconditions) (ObjectInfo, error) {
	if !overwrite {
		if _, err := s.StatObject(ctx, destinationBucket, destinationKey, externalprovider.Preconditions{IfNoneMatch: "*"}); err == nil {
			return ObjectInfo{}, conflict(nil)
		} else if !errors.Is(err, externalprovider.ErrNotFound) {
			return ObjectInfo{}, err
		}
	}
	copySource := url.PathEscape(sourceBucket + "/" + sourceKey)
	if preconditions.VersionID != "" {
		copySource += "?versionId=" + url.QueryEscape(preconditions.VersionID)
	}
	input := &awss3.CopyObjectInput{
		Bucket:     aws.String(destinationBucket),
		Key:        aws.String(destinationKey),
		CopySource: aws.String(copySource),
	}
	if preconditions.IfMatch != "" {
		input.CopySourceIfMatch = aws.String(preconditions.IfMatch)
	}
	output, err := s.client.CopyObject(ctx, input)
	if err != nil {
		return ObjectInfo{}, mapAWSError(err)
	}
	info := ObjectInfo{Key: destinationKey}
	if output.CopyObjectResult != nil {
		if output.CopyObjectResult.ETag != nil {
			info.ETag = *output.CopyObjectResult.ETag
		}
		if output.CopyObjectResult.LastModified != nil {
			info.Modified = *output.CopyObjectResult.LastModified
		}
	}
	return info, nil
}

func objectFromSDK(item awss3types.Object) ObjectInfo {
	info := ObjectInfo{}
	if item.Key != nil {
		info.Key = *item.Key
	}
	if item.Size != nil {
		info.Size = *item.Size
	}
	if item.LastModified != nil {
		info.Modified = *item.LastModified
	}
	if item.ETag != nil {
		info.ETag = *item.ETag
	}
	return info
}

func objectFromHead(output *awss3.HeadObjectOutput, key string) ObjectInfo {
	info := ObjectInfo{Key: key}
	if output.ContentLength != nil {
		info.Size = *output.ContentLength
	}
	if output.LastModified != nil {
		info.Modified = *output.LastModified
	}
	if output.ETag != nil {
		info.ETag = *output.ETag
	}
	if output.VersionId != nil {
		info.VersionID = *output.VersionId
	}
	if output.ContentType != nil {
		info.MediaType = *output.ContentType
	}
	info.Metadata = output.Metadata
	return info
}

func objectFromGet(output *awss3.GetObjectOutput, key string) ObjectInfo {
	info := ObjectInfo{Key: key}
	if output.ContentLength != nil {
		info.Size = *output.ContentLength
	}
	if output.LastModified != nil {
		info.Modified = *output.LastModified
	}
	if output.ETag != nil {
		info.ETag = *output.ETag
	}
	if output.VersionId != nil {
		info.VersionID = *output.VersionId
	}
	if output.ContentType != nil {
		info.MediaType = *output.ContentType
	}
	info.Metadata = output.Metadata
	return info
}

func applyHeadPreconditions(input *awss3.HeadObjectInput, preconditions externalprovider.Preconditions) {
	if preconditions.IfMatch != "" {
		input.IfMatch = aws.String(preconditions.IfMatch)
	}
	if preconditions.IfNoneMatch != "" {
		input.IfNoneMatch = aws.String(preconditions.IfNoneMatch)
	}
	if preconditions.VersionID != "" {
		input.VersionId = aws.String(preconditions.VersionID)
	}
}

func applyGetPreconditions(input *awss3.GetObjectInput, preconditions externalprovider.Preconditions) {
	if preconditions.IfMatch != "" {
		input.IfMatch = aws.String(preconditions.IfMatch)
	}
	if preconditions.IfNoneMatch != "" {
		input.IfNoneMatch = aws.String(preconditions.IfNoneMatch)
	}
	if preconditions.VersionID != "" {
		input.VersionId = aws.String(preconditions.VersionID)
	}
}

func validateEndpoint(value string, allowInsecure bool) (*url.URL, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, ErrInvalidEndpoint
	}
	u, err := url.Parse(value)
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return nil, ErrInvalidEndpoint
	}
	if u.Scheme != "https" && u.Scheme != "http" {
		return nil, ErrInvalidEndpoint
	}
	if err = externalprovider.ValidateEndpointTransport(u, allowInsecure); err != nil {
		return nil, errors.Join(ErrInvalidEndpoint, err)
	}
	if u.Path != "" && strings.Trim(u.Path, "/") != "" {
		parts := strings.Split(strings.Trim(u.Path, "/"), "/")
		if len(parts) > 1 || !validBucketName(parts[0]) {
			return nil, ErrInvalidEndpoint
		}
	}
	return u, nil
}

func validBucketName(value string) bool {
	if len(value) < 3 || len(value) > 63 || value != strings.ToLower(value) {
		return false
	}
	for index, char := range value {
		if (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char == '.' || char == '-' {
			if index == 0 && (char == '.' || char == '-') {
				return false
			}
			continue
		}
		return false
	}
	return !strings.HasSuffix(value, ".") && !strings.HasSuffix(value, "-") && !strings.Contains(value, "..")
}

func mapAWSError(err error) error {
	if err == nil {
		return nil
	}
	var responseErr *smithyhttp.ResponseError
	if errors.As(err, &responseErr) {
		switch responseErr.HTTPStatusCode() {
		case http.StatusNotFound:
			return notFound(err)
		case http.StatusForbidden:
			return externalprovider.ErrPermission
		case http.StatusPreconditionFailed, http.StatusConflict:
			return conflict(err)
		}
	}
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		switch strings.ToLower(apiErr.ErrorCode()) {
		case "nosuchkey", "nosuchbucket", "notfound", "nosuchversion":
			return notFound(err)
		case "preconditionfailed", "conditionalrequestconflict":
			return conflict(err)
		case "accessdenied", "invalidaccesskeyid", "signaturedoesnotmatch":
			return externalprovider.ErrPermission
		}
	}
	return unavailable(err)
}

func encodeCursor(offset int) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strconv.Itoa(offset)))
}

func decodeCursor(cursor string) (int, error) {
	if cursor == "" {
		return 0, nil
	}
	decoded, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return 0, externalprovider.ErrInvalidRequest
	}
	offset, err := strconv.Atoi(string(decoded))
	if err != nil || offset < 0 || offset > externalprovider.MaxPageLimit*externalprovider.MaxPageLimit {
		return 0, externalprovider.ErrInvalidRequest
	}
	return offset, nil
}
