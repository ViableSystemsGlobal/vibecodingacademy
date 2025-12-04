#!/bin/bash

# Quick Test Script
# Tests basic functionality of the application

set -e

echo "🧪 Starting Quick Tests..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3005}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3004}"

# Test counters
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Testing $name... "
    
    if response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null); then
        if [ "$response" -eq "$expected_status" ]; then
            echo -e "${GREEN}✓ PASS${NC} (Status: $response)"
            ((PASSED++))
            return 0
        else
            echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $response)"
            ((FAILED++))
            return 1
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (Connection error)"
        ((FAILED++))
        return 1
    fi
}

echo "📡 Testing Backend Endpoints..."
echo ""

# Backend Health Check
test_endpoint "Backend Health" "$BACKEND_URL/health"

# Public Endpoints
test_endpoint "Public Landing" "$BACKEND_URL/public/landing"
test_endpoint "Public Settings" "$BACKEND_URL/public/settings"
test_endpoint "Public Classes" "$BACKEND_URL/public/classes"

echo ""
echo "🌐 Testing Frontend..."
echo ""

# Frontend (if accessible)
if curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" | grep -q "200"; then
    echo -e "${GREEN}✓ Frontend accessible${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ Frontend not accessible (may need to be running)${NC}"
fi

echo ""
echo "📊 Test Results:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some tests failed. Check the output above.${NC}"
    exit 1
fi

