package utils

import (
	"fmt"
	"time"
)

type Future[T any] struct {
	result *T
	err    error
	done   chan struct{}
}

func NewFuture[T any](timeout int) *Future[T] {
	f := &Future[T]{
		done: make(chan struct{}),
	}
	if timeout > 0 {
		go func() {
			<-time.After(time.Duration(timeout) * time.Millisecond)
			if f.result != nil {
				return
			}
			f.err = fmt.Errorf("request timed out after %d ms", timeout)
			f.done <- struct{}{}
		}()
	}
	return f
}

func (f *Future[T]) Done() <-chan struct{} {
	return f.done
}

func (f *Future[T]) Result() (*T, error) {
	<-f.done
	return f.result, f.err
}

func (f *Future[T]) Resolve(result *T) {
	f.result = result
	f.done <- struct{}{}
}

func (f *Future[T]) Reject(err error) {
	f.err = err
	f.done <- struct{}{}
}
