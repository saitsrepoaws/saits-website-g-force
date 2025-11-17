#!/bin/bash

# ============================================
# TEST DEPENDENCIES INSTALLER
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                                      ║${NC}"
echo -e "${BLUE}║     📦 Installing Test Dependencies                                  ║${NC}"
echo -e "${BLUE}║                                                                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}Installing Vitest and related packages...${NC}"
echo ""

# Install test dependencies
pnpm add -D vitest @vitest/ui @types/node

echo ""
echo -e "${GREEN}✅ Test dependencies installed!${NC}"
echo ""

echo -e "${BLUE}Installed packages:${NC}"
echo "  - vitest (test framework)"
echo "  - @vitest/ui (test UI)"
echo "  - @types/node (Node.js types)"
echo ""

echo -e "${YELLOW}You can now run tests:${NC}"
echo "  pnpm test:smoke          # Quick smoke tests"
echo "  pnpm test:regression     # Full regression tests"
echo "  pnpm test:all            # All tests"
echo "  pnpm test:watch          # Watch mode"
echo "  pnpm test:ui             # UI mode"
echo ""

echo -e "${GREEN}✅ Ready to test!${NC}"
echo ""
