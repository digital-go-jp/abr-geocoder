package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"testing"

	"abrdb/internal/cli/command"
	"abrdb/internal/infra/db"
)

// TestMain doubles as the subprocess entry point for the exit code contract
// tests. When one of the helper environment variables is set, the test binary
// behaves as the abrdb process under test instead of running the test suite.
func TestMain(m *testing.M) {
	if behavior := os.Getenv("ABRDB_TEST_FINISH"); behavior != "" {
		os.Exit(finish(errForBehavior(behavior)))
	}
	if args := os.Getenv("ABRDB_TEST_RUN_ARGS"); args != "" {
		os.Args = append([]string{"abrdb"}, strings.Split(args, " ")...)
		os.Exit(run())
	}
	os.Exit(m.Run())
}

func errForBehavior(behavior string) error {
	switch behavior {
	case "nil":
		return nil
	case "pending":
		return command.ChangesPendingError{Message: "changes pending"}
	case "failure":
		return errors.New("boom")
	default:
		panic("unknown ABRDB_TEST_FINISH value: " + behavior)
	}
}

// runSubprocess re-executes the test binary in helper mode and returns its
// exit code and stderr.
func runSubprocess(t *testing.T, env ...string) (int, string) {
	t.Helper()
	exe, err := os.Executable()
	if err != nil {
		t.Fatalf("os.Executable() error = %v", err)
	}

	cmd := exec.CommandContext(t.Context(), exe)
	cmd.Dir = t.TempDir() // keep run()'s godotenv.Load from picking up a .env
	cmd.Env = append(os.Environ(), env...)
	var stderr strings.Builder
	cmd.Stderr = &stderr

	err = cmd.Run()
	code := 0
	if err != nil {
		exitErr, ok := errors.AsType[*exec.ExitError](err)
		if !ok {
			t.Fatalf("subprocess failed to run: %v", err)
		}
		code = exitErr.ExitCode()
	}
	return code, stderr.String()
}

// TestFinish_Subprocess pins the process-level contract of finish(): the exit
// code and whether stderr receives the error, for all three result classes.
func TestFinish_Subprocess(t *testing.T) {
	tests := []struct {
		name       string
		behavior   string
		wantCode   int
		wantStderr string
	}{
		{
			name:       "no error exits 0 with silent stderr",
			behavior:   "nil",
			wantCode:   0,
			wantStderr: "",
		},
		{
			name:       "changes pending exits 1 with silent stderr",
			behavior:   "pending",
			wantCode:   1,
			wantStderr: "",
		},
		{
			name:       "failure exits 2 and prints the error",
			behavior:   "failure",
			wantCode:   2,
			wantStderr: "boom\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			code, stderr := runSubprocess(t, "ABRDB_TEST_FINISH="+tt.behavior)
			if code != tt.wantCode {
				t.Errorf("exit code = %d, want %d", code, tt.wantCode)
			}
			if stderr != tt.wantStderr {
				t.Errorf("stderr = %q, want %q", stderr, tt.wantStderr)
			}
		})
	}
}

// TestRun_Subprocess drives the real run() command path in a subprocess for
// the exit paths that need no database state.
func TestRun_Subprocess(t *testing.T) {
	t.Run("version exits 0 with silent stderr", func(t *testing.T) {
		code, stderr := runSubprocess(t, "ABRDB_TEST_RUN_ARGS=version")
		if code != 0 {
			t.Errorf("exit code = %d, want 0", code)
		}
		if stderr != "" {
			t.Errorf("stderr = %q, want empty", stderr)
		}
	})

	t.Run("dry-run with unreachable database exits 2 with error on stderr", func(t *testing.T) {
		// Port 1 on localhost refuses immediately, so the failure is fast.
		code, stderr := runSubprocess(t,
			"ABRDB_TEST_RUN_ARGS=import --dry-run",
			"DB_HOST=127.0.0.1", "DB_PORT=1", "DB_SSLMODE=disable",
		)
		if code != 2 {
			t.Errorf("exit code = %d, want 2", code)
		}
		if !strings.Contains(stderr, "query executor") {
			t.Errorf("stderr = %q, want the connection error", stderr)
		}
	})
}

// TestExitCode pins the exit code contract that the AWS Step Functions daily
// workflow depends on: 0 = no changes / success, 1 = dry-run found pending
// changes, 2 = failure.
func TestExitCode(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want int
	}{
		{
			name: "nil error is success",
			err:  nil,
			want: 0,
		},
		{
			name: "changes pending error exits 1",
			err:  command.ChangesPendingError{Message: "changes pending"},
			want: 1,
		},
		{
			name: "wrapped changes pending error exits 1",
			err:  fmt.Errorf("dry-run: %w", command.ChangesPendingError{Message: "changes pending"}),
			want: 1,
		},
		{
			name: "generic error exits 2",
			err:  errors.New("connection refused"),
			want: 2,
		},
		{
			name: "import lock held by another process exits 2",
			err:  fmt.Errorf("acquire lock: %w", db.ErrImportLocked),
			want: 2,
		},
		{
			name: "wrapped generic error exits 2",
			err:  fmt.Errorf("scan and compare catalog: %w", errors.New("http 500")),
			want: 2,
		},
		{
			name: "context canceled exits 2",
			err:  context.Canceled,
			want: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := exitCode(tt.err); got != tt.want {
				t.Errorf("exitCode(%v) = %d, want %d", tt.err, got, tt.want)
			}
		})
	}
}
