#!/bin/bash

# ============================================
# SMOKE TEST RUNNER - Quick validation
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                                      ║${NC}"
echo -e "${BLUE}║     🔥 SMOKE TESTS - Quick Validation                               ║${NC}"
echo -e "${BLUE}║                                                                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Environment
export VITE_PLAYER_URL="${VITE_PLAYER_URL:-https://splashfm.nl}"
export VITE_STREAM_URL="${VITE_STREAM_URL:-https://splashfm.nl/splashfm.mp3}"
export VITE_STATUS_URL="${VITE_STATUS_URL:-https://splashfm.nl/status-json.xsl}"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Player URL: $VITE_PLAYER_URL"
echo "  Stream URL: $VITE_STREAM_URL"
echo "  Status URL: $VITE_STATUS_URL"
echo ""

# Check if vitest is installed
if ! command -v vitest &> /dev/null && ! npx vitest --version &> /dev/null 2>&1; then
    echo -e "${RED}❌ Vitest not found! Installing...${NC}"
    echo ""
    pnpm add -D vitest @vitest/ui @types/node
    echo ""
fi

# Run smoke tests
echo -e "${GREEN}Running smoke tests...${NC}"
echo ""

npx vitest run tests/smoke/ --reporter=verbose

TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                                      ║${NC}"
    echo -e "${GREEN}║     ✅ ALL SMOKE TESTS PASSED!                                       ║${NC}"
    echo -e "${GREEN}║                                                                      ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
else
    echo -e "${RED}╔══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                                      ║${NC}"
    echo -e "${RED}║     ❌ SMOKE TESTS FAILED!                                           ║${NC}"
    echo -e "${RED}║                                                                      ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Duration: < 30 seconds${NC}"
echo -e "${BLUE}Scope: Critical paths only${NC}"
echo ""
