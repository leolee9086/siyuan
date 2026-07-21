package sages

import (
	"sync"
	"testing"

	"github.com/pkoukk/tiktoken-go"
)

func TestGetTokenEncoderConcurrentCacheMiss(t *testing.T) {
	encoderMu.Lock()
	previousMap := encoderMap
	previousDefaultEncoder := defaultEncoder
	previousReady := encodersReady
	expected := &tiktoken.Tiktoken{}
	encoderMap = map[string]*tiktoken.Tiktoken{}
	defaultEncoder = expected
	encodersReady = true
	encoderMu.Unlock()
	t.Cleanup(func() {
		encoderMu.Lock()
		encoderMap = previousMap
		defaultEncoder = previousDefaultEncoder
		encodersReady = previousReady
		encoderMu.Unlock()
	})

	const model = "deepseek-v4-flash"
	const workers = 64
	encoders := make(chan *tiktoken.Tiktoken, workers)
	start := make(chan struct{})
	var waitGroup sync.WaitGroup
	waitGroup.Add(workers)
	for range workers {
		go func() {
			defer waitGroup.Done()
			<-start
			encoders <- getTokenEncoder(model)
		}()
	}
	close(start)
	waitGroup.Wait()
	close(encoders)

	for encoder := range encoders {
		if encoder != expected {
			t.Fatal("concurrent cache miss returned an unexpected encoder instance")
		}
	}
}
