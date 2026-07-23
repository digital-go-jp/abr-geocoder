package command

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"sync"

	"golang.org/x/sync/errgroup"

	"abr.local/common/progress"
)

type job[R any] struct {
	Index   int
	Address string
	Result  R
	Err     error
}

// ProcessFunc processes an address and returns a result.
type processFunc[R any] func(ctx context.Context, address string) (R, error)

type errorResponse struct {
	Error string `json:"error"`
	Input string `json:"input"`
}

type parallelProcessor[R any] struct {
	Process    processFunc[R]
	Workers    int
	BufferSize int
	Monitor    progress.Monitor
}

// Run executes the parallel processing pipeline.
// Uses errgroup for coordinated error handling and context propagation.
func (p *parallelProcessor[R]) Run(ctx context.Context, r io.Reader, w io.Writer) error {
	eg, ctx := errgroup.WithContext(ctx)

	jobs := make(chan *job[R], p.BufferSize)
	results := make(chan *job[R], p.BufferSize)

	// reader: closes jobs channel when done
	eg.Go(func() error {
		return p.reader(ctx, r, jobs)
	})

	// workers: process jobs and send results
	var wg sync.WaitGroup
	for range p.Workers {
		wg.Go(func() {
			p.worker(ctx, jobs, results)
		})
	}

	// results closer: closes results after all workers finish
	eg.Go(func() error {
		wg.Wait()
		close(results)
		return nil
	})

	// writer: writes results to output
	eg.Go(func() error {
		return p.writer(w, results)
	})

	return eg.Wait()
}

func (p *parallelProcessor[R]) worker(ctx context.Context, jobs <-chan *job[R], results chan<- *job[R]) {
	for job := range jobs {
		select {
		case <-ctx.Done():
			return
		default:
		}
		job.Result, job.Err = p.Process(ctx, job.Address)
		results <- job
	}
}

func (p *parallelProcessor[R]) reader(ctx context.Context, r io.Reader, jobs chan<- *job[R]) error {
	defer close(jobs)
	scanner := bufio.NewScanner(r)
	for i := 0; scanner.Scan(); {
		if addr := scanner.Text(); addr != "" {
			select {
			case jobs <- &job[R]{Index: i, Address: addr}:
				i++
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}
	return scanner.Err()
}

func (p *parallelProcessor[R]) writer(w io.Writer, results <-chan *job[R]) error {
	bw := bufio.NewWriter(w)
	enc := json.NewEncoder(bw)
	pending := make(map[int]*job[R])
	next := 0
	var encodeErr error

	encodeJob := func(j *job[R]) {
		if encodeErr != nil {
			return
		}
		if j.Err != nil {
			encodeErr = enc.Encode(errorResponse{Error: j.Err.Error(), Input: j.Address})
		} else {
			encodeErr = enc.Encode(j.Result)
		}
		if p.Monitor != nil {
			p.Monitor.UpdateProgress(1)
		}
	}

	for job := range results {
		pending[job.Index] = job
		for {
			j, ok := pending[next]
			if !ok {
				break
			}
			encodeJob(j)
			delete(pending, next)
			next++
		}
	}

	if p.Monitor != nil {
		p.Monitor.CompleteTask()
	}

	if encodeErr != nil {
		return encodeErr
	}
	return bw.Flush()
}
