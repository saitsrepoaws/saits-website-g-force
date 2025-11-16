#!/bin/bash

# ============================================
# REGRESSION TEST RUNNER - Comprehensive validation
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
echo -e "${BLUE}║     🧪 REGRESSION TESTS - Full Validation                           ║${NC}"
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

# Run regression tests
echo -e "${GREEN}Running regression tests (this may take 2-5 minutes)...${NC}"
echo ""

npx vitest run tests/regression/ --reporter=verbose

TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                                      ║${NC}"
    echo -e "${GREEN}║     ✅ ALL REGRESSION TESTS PASSED!                                  ║${NC}"
    echo -e "${GREEN}║                                                                      ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
else
    echo -e "${RED}╔══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                                      ║${NC}"
    echo -e "${RED}║     ❌ REGRESSION TESTS FAILED!                                      ║${NC}"
    echo -e "${RED}║                                                                      ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Duration: 2-5 minutes${NC}"
echo -e "${BLUE}Scope: All player functionality${NC}"
echo ""
