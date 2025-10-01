#!/bin/bash
# Test Runner for Extraction System
# Runs all tests and generates coverage report

echo "🧪 Running Extraction System Tests"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Jest is installed
if ! command -v jest &> /dev/null; then
    echo -e "${YELLOW}⚠️  Jest not found. Installing...${NC}"
    npm install --save-dev jest
fi

# Run unit tests
echo -e "${GREEN}📝 Running Unit Tests${NC}"
echo "--------------------"
npm test -- tests/extraction/adaptiveExtractor.test.js

UNIT_EXIT=$?

echo ""
echo -e "${GREEN}🔗 Running Integration Tests${NC}"
echo "----------------------------"
npm test -- tests/integration/extraction.integration.test.js

INTEGRATION_EXIT=$?

echo ""
echo "===================================="

# Summary
if [ $UNIT_EXIT -eq 0 ] && [ $INTEGRATION_EXIT -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    if [ $UNIT_EXIT -ne 0 ]; then
        echo -e "${RED}   - Unit tests failed${NC}"
    fi
    if [ $INTEGRATION_EXIT -ne 0 ]; then
        echo -e "${RED}   - Integration tests failed${NC}"
    fi
    exit 1
fi

