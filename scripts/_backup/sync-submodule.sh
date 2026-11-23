#!/bin/bash
set -e
cd "$(dirname "$0")/.."
git push origin main
cd ..
git add wetothemoon-electron
git commit -m "chore: bump submodule to $(cd wetothemoon-electron && git rev-parse --short HEAD)"
git push origin main
echo "✅ submodule + parent pushed"