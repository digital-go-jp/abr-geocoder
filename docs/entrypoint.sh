#!/bin/sh
set -e

# Install mermaid assets if not already installed
if [ -d "docs" ] && [ ! -f "docs/theme/mermaid.min.js" ]; then
  echo "Installing mdbook-mermaid assets..."
  mdbook-mermaid install docs/
fi

# Execute the original command
exec mdbook "$@"
