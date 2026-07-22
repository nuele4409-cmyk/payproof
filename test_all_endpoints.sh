#!/bin/bash
# Comprehensive endpoint test script for PayProof
# Tests all 17+ API endpoints and reports pass/fail for each

BASE="http://localhost:3000/api"
PASS=0
FAIL=0
ALL_TESTS=()

test_endpoint() {
  local description="$1"
  local method="$2"
  local url="$3"
  local data="$4"
  local auth_header="$5"
  local expected_code="${6:-200}"

  local response
  local http_code

  if [ "$method" = "GET" ]; then
    if [ -n "$auth_header" ]; then
      response=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $auth_header" "$url" 2>/dev/null)
    else
      response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
    fi
  else
    if [ -n "$auth_header" ]; then
      response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -H "Authorization: Bearer $auth_header" -d "$data" "$url" 2>/dev/null)
    else
      response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null)
    fi
  fi

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "$expected_code" ]; then
    echo "  ✅ PASS [$http_code] $description"
    ALL_TESTS+=("PASS")
    ((PASS++))
  else
    echo "  ❌ FAIL [$http_code] $description (expected $expected_code)"
    echo "     Body: $(echo "$body" | head -c 200)"
    ALL_TESTS+=("FAIL")
    ((FAIL++))
  fi
}

echo "========================================"
echo "  PayProof Endpoint Test Suite"
echo "========================================"
echo ""

# =============================================
# 1. HEALTH CHECK
# =============================================
echo "--- 1. Health ---"
test_endpoint "GET /api/health" "GET" "$BASE/health"

# =============================================
# 2. REGISTER SELLER + BUYER
# =============================================
echo ""
echo "--- 2. Auth: Register & Login ---"

SELLER_RESP=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"TestSellerFull","contact":"seller_full_'$RANDOM'@test.com","password":"password123","role":"seller","bvn":"12345678901"}' 2>/dev/null)
SELLER_TOKEN=$(echo "$SELLER_RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
SELLER_ID=$(echo "$SELLER_RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
SELLER_HTTP=$(echo "$SELLER_RESP" | curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"TestSellerFull","contact":"seller_full_'$RANDOM'@test.com","password":"password123","role":"seller","bvn":"12345678901"}')
# Actually get the real http code from the response
SELLER_REG_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"TestSellerFull","contact":"seller_full_'$RANDOM'@test.com","password":"password123","role":"seller","bvn":"12345678901"}' 2>/dev/null)
SELLER_REG_CODE=$(echo "$SELLER_REG_RESP" | tail -1)
SELLER_REG_BODY=$(echo "$SELLER_REG_RESP" | sed '$d')
SELLER_TOKEN=$(echo "$SELLER_REG_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
SELLER_ID=$(echo "$SELLER_REG_BODY" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

if [ "$SELLER_REG_CODE" = "201" ] || [ "$SELLER_REG_CODE" = "200" ]; then
  echo "  ✅ PASS [$SELLER_REG_CODE] POST /api/auth/register (seller)"
  ((PASS++))
else
  echo "  ❌ FAIL [$SELLER_REG_CODE] POST /api/auth/register (seller)"
  echo "     Body: $(echo "$SELLER_REG_BODY" | head -c 200)"
  ((FAIL++))
fi

# If seller registration failed (maybe duplicate contact due to RANDOM collision), try login
if [ -z "$SELLER_TOKEN" ]; then
  # Try to login with last used contact from the attempt
  SELLER_LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"contact":"seller_full_test@test.com","password":"password123"}' 2>/dev/null)
  SELLER_LOGIN_CODE=$(echo "$SELLER_LOGIN_RESP" | tail -1)
  SELLER_LOGIN_BODY=$(echo "$SELLER_LOGIN_RESP" | sed '$d')
  SELLER_TOKEN=$(echo "$SELLER_LOGIN_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  SELLER_ID=$(echo "$SELLER_LOGIN_BODY" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  if [ -n "$SELLER_TOKEN" ]; then
    echo "  ⚠️  Seller already existed — logged in instead"
  fi
fi

BUYER_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"TestBuyerFull","contact":"buyer_full_'$RANDOM'@test.com","password":"password123","role":"buyer"}' 2>/dev/null)
BUYER_REG_CODE=$(echo "$BUYER_RESP" | tail -1)
BUYER_REG_BODY=$(echo "$BUYER_RESP" | sed '$d')
BUYER_TOKEN=$(echo "$BUYER_REG_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
BUYER_ID=$(echo "$BUYER_REG_BODY" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

if [ "$BUYER_REG_CODE" = "201" ] || [ "$BUYER_REG_CODE" = "200" ]; then
  echo "  ✅ PASS [$BUYER_REG_CODE] POST /api/auth/register (buyer)"
  ((PASS++))
else
  echo "  ❌ FAIL [$BUYER_REG_CODE] POST /api/auth/register (buyer)"
  echo "     Body: $(echo "$BUYER_REG_BODY" | head -c 200)"
  ((FAIL++))
fi

echo ""
echo "--- Auth: Login Tests ---"

# Login seller
LOGIN_SELLER_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"contact\":\"$(echo "$SELLER_REG_BODY" | grep -o '"contact":"[^"]*"' | cut -d'"' -f4)\",\"password\":\"password123\"}" 2>/dev/null)
LS_CODE=$(echo "$LOGIN_SELLER_RESP" | tail -1)
LS_BODY=$(echo "$LOGIN_SELLER_RESP" | sed '$d')
if [ "$LS_CODE" = "200" ]; then
  SELLER_TOKEN=$(echo "$LS_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  echo "  ✅ PASS [200] POST /api/auth/login (seller)"
  ((PASS++))
else
  echo "  ❌ FAIL [$LS_CODE] POST /api/auth/login (seller)"
  ((FAIL++))
fi

# Login buyer
LOGIN_BUYER_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"contact\":\"$(echo "$BUYER_REG_BODY" | grep -o '"contact":"[^"]*"' | cut -d'"' -f4)\",\"password\":\"password123\"}" 2>/dev/null)
LB_CODE=$(echo "$LOGIN_BUYER_RESP" | tail -1)
LB_BODY=$(echo "$LOGIN_BUYER_RESP" | sed '$d')
if [ "$LB_CODE" = "200" ]; then
  BUYER_TOKEN=$(echo "$LB_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  echo "  ✅ PASS [200] POST /api/auth/login (buyer)"
  ((PASS++))
else
  echo "  ❌ FAIL [$LB_CODE] POST /api/auth/login (buyer)"
  ((FAIL++))
fi

# Login invalid
test_endpoint "POST /api/auth/login (bad password)" "POST" "$BASE/auth/login" \
  '{"contact":"nonexistent@test.com","password":"wrong"}' "" "401"

echo ""
echo "--- Auth: Register edge cases ---"
test_endpoint "POST /api/auth/register (missing name)" "POST" "$BASE/auth/register" \
  '{"contact":"test@test.com","password":"password123","role":"buyer"}' "" "400"
test_endpoint "POST /api/auth/register (invalid role)" "POST" "$BASE/auth/register" \
  '{"name":"X","contact":"test@test.com","password":"password123","role":"admin"}' "" "400"
test_endpoint "POST /api/auth/register (short password)" "POST" "$BASE/auth/register" \
  '{"name":"X","contact":"test@test.com","password":"short","role":"buyer"}' "" "400"

# =============================================
# 3. SELLER PRODUCT
# =============================================
echo ""
echo "--- 3. Product ---"

PRODUCT_SLUG="store-$SELLER_ID"

# GET seller/me/product (no product yet)
test_endpoint "GET /api/seller/me/product (no product)" "GET" "$BASE/seller/me/product" "" "$SELLER_TOKEN" "200"

# PUT seller/me/product (create)
test_endpoint "PUT /api/seller/me/product (create)" "PUT" "$BASE/seller/me/product" \
  '{"name":"Test Widget","price":5000,"description":"A fine widget for testing all endpoints"}' "$SELLER_TOKEN" "200"

# GET seller/me/product (after create)
test_endpoint "GET /api/seller/me/product (exists)" "GET" "$BASE/seller/me/product" "" "$SELLER_TOKEN" "200"

# PUT seller/me/product (update)
test_endpoint "PUT /api/seller/me/product (update)" "PUT" "$BASE/seller/me/product" \
  '{"name":"Updated Widget","price":7500,"description":"An updated widget"}' "$SELLER_TOKEN" "200"

# GET products/[slug] (public)
test_endpoint "GET /api/products/[slug] (public)" "GET" "$BASE/products/$PRODUCT_SLUG" "" "" "200"

# GET products/[id] (not found)
test_endpoint "GET /api/products/nonexistent (404)" "GET" "$BASE/products/nonexistent-slug" "" "" "404"

# PUT seller/me/product (no auth)
test_endpoint "PUT /api/seller/me/product (no auth)" "PUT" "$BASE/seller/me/product" \
  '{"name":"X","price":100,"description":"Y"}' "" "401"

# PUT seller/me/product (buyer token)
test_endpoint "PUT /api/seller/me/product (buyer auth)" "PUT" "$BASE/seller/me/product" \
  '{"name":"X","price":100,"description":"Y"}' "$BUYER_TOKEN" "403"

# PUT seller/me/product (invalid price)
test_endpoint "PUT /api/seller/me/product (invalid price)" "PUT" "$BASE/seller/me/product" \
  '{"name":"X","price":-5,"description":"Y"}' "$SELLER_TOKEN" "400"

# =============================================
# 4. SELLER PROFILE
# =============================================
echo ""
echo "--- 4. Seller Profile ---"

# GET /api/seller/me
test_endpoint "GET /api/seller/me" "GET" "$BASE/seller/me" "" "$SELLER_TOKEN" "200"

# GET /api/seller/me (no auth)
test_endpoint "GET /api/seller/me (no auth)" "GET" "$BASE/seller/me" "" "" "401"

# GET /api/seller/me (buyer token)
test_endpoint "GET /api/seller/me (buyer token)" "GET" "$BASE/seller/me" "" "$BUYER_TOKEN" "403"

# =============================================
# 5. SETTLEMENT ACCOUNT
# =============================================
echo ""
echo "--- 5. Settlement ---"

# PUT /api/seller/me/settlement
test_endpoint "PUT /api/seller/me/settlement" "PUT" "$BASE/seller/me/settlement" \
  '{"bankCode":"035","accountNumber":"1234567890"}' "$SELLER_TOKEN" "200"
# In sandbox mode this should succeed with "Sandbox Account" name

# PUT /api/seller/me/settlement (no auth)
test_endpoint "PUT /api/seller/me/settlement (no auth)" "PUT" "$BASE/seller/me/settlement" \
  '{"bankCode":"035","accountNumber":"1234567890"}' "" "401"

# PUT /api/seller/me/settlement (missing fields)
test_endpoint "PUT /api/seller/me/settlement (missing fields)" "PUT" "$BASE/seller/me/settlement" \
  '{"bankCode":"035"}' "$SELLER_TOKEN" "400"

# =============================================
# 6. ORDERS
# =============================================
echo ""
echo "--- 6. Orders ---"

# POST /api/orders (anonymous)
ANON_ORDER_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/orders" \
  -H "Content-Type: application/json" \
  -d '{"buyerName":"Anonymous Buyer","productSlug":"'"$PRODUCT_SLUG"'","phone":"08031234567"}' 2>/dev/null)
ANON_ORDER_CODE=$(echo "$ANON_ORDER_RESP" | tail -1)
ANON_ORDER_BODY=$(echo "$ANON_ORDER_RESP" | sed '$d')
ANON_ORDER_ID=$(echo "$ANON_ORDER_BODY" | grep -o '"id":"PP-[^"]*"' | cut -d'"' -f4)

if [ "$ANON_ORDER_CODE" = "201" ] || [ "$ANON_ORDER_CODE" = "200" ]; then
  echo "  ✅ PASS [$ANON_ORDER_CODE] POST /api/orders (anonymous)"
  ((PASS++))
else
  echo "  ❌ FAIL [$ANON_ORDER_CODE] POST /api/orders (anonymous)"
  echo "     Body: $(echo "$ANON_ORDER_BODY" | head -c 200)"
  ((FAIL++))
fi

# POST /api/orders (buyer signed-in)
BUYER_ORDER_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -d '{"buyerName":"SignedIn Buyer","productSlug":"'"$PRODUCT_SLUG"'","phone":"08039876543"}' 2>/dev/null)
BUYER_ORDER_CODE=$(echo "$BUYER_ORDER_RESP" | tail -1)
BUYER_ORDER_BODY=$(echo "$BUYER_ORDER_RESP" | sed '$d')
BUYER_ORDER_ID=$(echo "$BUYER_ORDER_BODY" | grep -o '"id":"PP-[^"]*"' | cut -d'"' -f4)

if [ "$BUYER_ORDER_CODE" = "201" ] || [ "$BUYER_ORDER_CODE" = "200" ]; then
  echo "  ✅ PASS [$BUYER_ORDER_CODE] POST /api/orders (signed-in buyer)"
  ((PASS++))
else
  echo "  ❌ FAIL [$BUYER_ORDER_CODE] POST /api/orders (signed-in buyer)"
  echo "     Body: $(echo "$BUYER_ORDER_BODY" | head -c 200)"
  ((FAIL++))
fi

# POST /api/orders (missing fields)
test_endpoint "POST /api/orders (missing productSlug)" "POST" "$BASE/orders" \
  '{"buyerName":"X"}' "" "400"

# POST /api/orders (bad product slug)
test_endpoint "POST /api/orders (bad slug)" "POST" "$BASE/orders" \
  '{"buyerName":"X","productSlug":"nonexistent-slug-999"}' "" "400"

# GET /api/orders (seller)
test_endpoint "GET /api/orders (seller)" "GET" "$BASE/orders" "" "$SELLER_TOKEN" "200"

# GET /api/orders (buyer → 403)
test_endpoint "GET /api/orders (buyer → 403)" "GET" "$BASE/orders" "" "$BUYER_TOKEN" "403"

# GET /api/orders (no auth → 401)
test_endpoint "GET /api/orders (no auth → 401)" "GET" "$BASE/orders" "" "" "401"

# GET /api/orders/buyer (buyer)
test_endpoint "GET /api/orders/buyer (buyer)" "GET" "$BASE/orders/buyer" "" "$BUYER_TOKEN" "200"

# GET /api/orders/buyer (no auth → 401)
test_endpoint "GET /api/orders/buyer (no auth → 401)" "GET" "$BASE/orders/buyer" "" "" "401"

# GET /api/orders/buyer (seller → 403)
test_endpoint "GET /api/orders/buyer (seller → 403)" "GET" "$BASE/orders/buyer" "" "$SELLER_TOKEN" "403"

# GET /api/orders/[id] (anonymous order, public)
if [ -n "$ANON_ORDER_ID" ]; then
  test_endpoint "GET /api/orders/[id] (public, anon order)" "GET" "$BASE/orders/$ANON_ORDER_ID" "" "" "200"
fi

# GET /api/orders/[id] (buyer order, public — check no settlement leak)
if [ -n "$BUYER_ORDER_ID" ]; then
  ORDER_PUBLIC_RESP=$(curl -s -w "\n%{http_code}" "$BASE/orders/$BUYER_ORDER_ID" 2>/dev/null)
  ORDER_PUBLIC_CODE=$(echo "$ORDER_PUBLIC_RESP" | tail -1)
  ORDER_PUBLIC_BODY=$(echo "$ORDER_PUBLIC_RESP" | sed '$d')
  if [ "$ORDER_PUBLIC_CODE" = "200" ]; then
    HAS_SETTLEMENT=$(echo "$ORDER_PUBLIC_BODY" | grep -c "settlement")
    if [ "$HAS_SETTLEMENT" -eq 0 ]; then
      echo "  ✅ PASS [200] GET /api/orders/[id] (public, no settlement leak)"
      ((PASS++))
    else
      echo "  ❌ FAIL [200] GET /api/orders/[id] (settlement LEAKED to public)"
      ((FAIL++))
    fi
  else
    echo "  ❌ FAIL [$ORDER_PUBLIC_CODE] GET /api/orders/[id] (public)"
    ((FAIL++))
  fi

  # GET /api/orders/[id] (seller — should see settlement)
  ORDER_SELLER_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $SELLER_TOKEN" "$BASE/orders/$BUYER_ORDER_ID" 2>/dev/null)
  ORDER_SELLER_CODE=$(echo "$ORDER_SELLER_RESP" | tail -1)
  ORDER_SELLER_BODY=$(echo "$ORDER_SELLER_RESP" | sed '$d')
  if [ "$ORDER_SELLER_CODE" = "200" ]; then
    HAS_SETTLEMENT=$(echo "$ORDER_SELLER_BODY" | grep -c "settlement")
    if [ "$HAS_SETTLEMENT" -ge 1 ]; then
      echo "  ✅ PASS [200] GET /api/orders/[id] (seller, has settlement)"
      ((PASS++))
    else
      echo "  ❌ FAIL [200] GET /api/orders/[id] (seller, no settlement)"
      ((FAIL++))
    fi
  else
    echo "  ❌ FAIL [$ORDER_SELLER_CODE] GET /api/orders/[id] (seller)"
    ((FAIL++))
  fi
fi

# GET /api/orders/[id] (not found)
test_endpoint "GET /api/orders/PP-NONEXISTENT (404)" "GET" "$BASE/orders/PP-NONEXISTENT" "" "" "404"

# =============================================
# 7. SIMULATE PAYMENT + STATE TRANSITIONS
# =============================================
echo ""
echo "--- 7. Payment & State Transitions ---"

if [ -n "$ANON_ORDER_ID" ]; then
  # Simulate payment for anonymous order
  SIM_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/monnify/simulate" \
    -H "Content-Type: application/json" \
    -d '{"orderId":"'"$ANON_ORDER_ID"'"}' 2>/dev/null)
  SIM_CODE=$(echo "$SIM_RESP" | tail -1)
  if [ "$SIM_CODE" = "200" ]; then
    echo "  ✅ PASS [200] POST /api/monnify/simulate"
    ((PASS++))
  else
    echo "  ❌ FAIL [$SIM_CODE] POST /api/monnify/simulate"
    echo "     Body: $(echo "$SIM_RESP" | sed '$d' | head -c 200)"
    ((FAIL++))
  fi

  # Mark as shipped (seller)
  test_endpoint "POST /api/orders/[id]/ship (seller)" "POST" "$BASE/orders/$ANON_ORDER_ID/ship" "" "$SELLER_TOKEN" "200"

  # Mark as shipped (no auth)
  test_endpoint "POST /api/orders/[id]/ship (no auth)" "POST" "$BASE/orders/$ANON_ORDER_ID/ship" "" "" "401"

  # Mark as shipped (buyer)
  test_endpoint "POST /api/orders/[id]/ship (buyer → 403)" "POST" "$BASE/orders/$ANON_ORDER_ID/ship" "" "$BUYER_TOKEN" "403"

  # Confirm delivery (anonymous)
  test_endpoint "POST /api/orders/[id]/confirm-delivery (anonymous)" "POST" "$BASE/orders/$ANON_ORDER_ID/confirm-delivery" "" "" "200"
fi

# For buyer's order: simulate payment, ship, confirm
if [ -n "$BUYER_ORDER_ID" ]; then
  SIM2_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/monnify/simulate" \
    -H "Content-Type: application/json" \
    -d '{"orderId":"'"$BUYER_ORDER_ID"'"}' 2>/dev/null)
  SIM2_CODE=$(echo "$SIM2_RESP" | tail -1)
  if [ "$SIM2_CODE" = "200" ]; then
    echo "  ✅ PASS [200] POST /api/monnify/simulate (2nd order)"
    ((PASS++))
  else
    echo "  ❌ FAIL [$SIM2_CODE] POST /api/monnify/simulate (2nd order)"
    echo "     Body: $(echo "$SIM2_RESP" | sed '$d' | head -c 200)"
    ((FAIL++))
  fi
fi

# =============================================
# 8. WEBHOOK
# =============================================
echo ""
echo "--- 8. Webhook ---"

# POST /api/monnify/webhook (invalid payload - should 200 ACK)
test_endpoint "POST /api/monnify/webhook (invalid JSON)" "POST" "$BASE/monnify/webhook" \
  'not json' "" "200"

# POST /api/monnify/webhook (valid but non-SUCCESSFUL_TRANSACTION)
test_endpoint "POST /api/monnify/webhook (non-success event)" "POST" "$BASE/monnify/webhook" \
  '{"eventType":"FAILED_TRANSACTION","eventData":{}}' "" "200"

# POST /api/monnify/webhook (missing transactionReference)
test_endpoint "POST /api/monnify/webhook (no ref)" "POST" "$BASE/monnify/webhook" \
  '{"eventType":"SUCCESSFUL_TRANSACTION","eventData":{}}' "" "200"

# POST /api/monnify/replay (missing reference)
test_endpoint "POST /api/monnify/replay (missing ref)" "POST" "$BASE/monnify/replay" \
  '{}' "" "400"

# POST /api/monnify/replay (bad reference)
test_endpoint "POST /api/monnify/replay (bad ref)" "POST" "$BASE/monnify/replay" \
  '{"transactionReference":"NONEXISTENT"}' "" "404"

# POST /api/monnify/simulate (bad state)
test_endpoint "POST /api/monnify/simulate (already paid)" "POST" "$BASE/monnify/simulate" \
  '{"orderId":"'"$ANON_ORDER_ID"'"}' "" "400"

# =============================================
# 9. PAYOUTS
# =============================================
echo ""
echo "--- 9. Payouts ---"

# POST /api/payouts/validate-bank (seller)
test_endpoint "POST /api/payouts/validate-bank (seller)" "POST" "$BASE/payouts/validate-bank" \
  '{"bankCode":"035","accountNumber":"1234567890"}' "$SELLER_TOKEN" "200"

# POST /api/payouts/validate-bank (no auth)
test_endpoint "POST /api/payouts/validate-bank (no auth)" "POST" "$BASE/payouts/validate-bank" \
  '{"bankCode":"035","accountNumber":"1234567890"}' "" "401"

# POST /api/payouts/validate-bank (buyer → 403)
test_endpoint "POST /api/payouts/validate-bank (buyer → 403)" "POST" "$BASE/payouts/validate-bank" \
  '{"bankCode":"035","accountNumber":"1234567890"}' "$BUYER_TOKEN" "403"

# POST /api/payouts/release/[id] (completed order)
if [ -n "$ANON_ORDER_ID" ]; then
  test_endpoint "POST /api/payouts/release/[id]" "POST" "$BASE/payouts/release/$ANON_ORDER_ID" "" "$SELLER_TOKEN" "200"
fi

# POST /api/payouts/release/[id] (not found)
test_endpoint "POST /api/payouts/release/PP-NONEXISTENT (404)" "POST" "$BASE/payouts/release/PP-NONEXISTENT" "" "$SELLER_TOKEN" "404"

# POST /api/payouts/release/[id] (no auth)
test_endpoint "POST /api/payouts/release/[id] (no auth → 401)" "POST" "$BASE/payouts/release/$ANON_ORDER_ID" "" "" "401"

# POST /api/payouts/release/[id] (double claim)
if [ -n "$ANON_ORDER_ID" ]; then
  test_endpoint "POST /api/payouts/release/[id] (double claim → 409)" "POST" "$BASE/payouts/release/$ANON_ORDER_ID" "" "$SELLER_TOKEN" "409"
fi

# POST /api/payouts/release/[id] (buyer → 403)
if [ -n "$ANON_ORDER_ID" ]; then
  test_endpoint "POST /api/payouts/release/[id] (buyer → 403)" "POST" "$BASE/payouts/release/$ANON_ORDER_ID" "" "$BUYER_TOKEN" "403"
fi

# =============================================
# SUMMARY
# =============================================
echo ""
echo "========================================"
echo "  RESULTS: $PASS passed, $FAIL failed"
echo "========================================"

exit $FAIL
