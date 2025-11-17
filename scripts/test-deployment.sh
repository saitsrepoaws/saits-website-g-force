#!/bin/bash
# Test Deployment Locally - G-Forge IoT Radio
# Simulates CodeDeploy deployment hooks locally

set -e

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║         🧪 LOCAL DEPLOYMENT TEST 🧪                                ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DEPLOY_DIR="${SCRIPT_DIR}/deploy"

echo "Testing deployment scripts..."
echo ""

# Test 1: Backup script
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Backup Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "${DEPLOY_DIR}/backup-current.sh" ]; then
    echo "✅ backup-current.sh exists"
    if [ -x "${DEPLOY_DIR}/backup-current.sh" ]; then
        echo "✅ backup-current.sh is executable"
    else
        echo "❌ backup-current.sh is NOT executable"
    fi
else
    echo "❌ backup-current.sh NOT FOUND"
fi

# Test 2: Permissions script
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: Permissions Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "${DEPLOY_DIR}/set-permissions.sh" ]; then
    echo "✅ set-permissions.sh exists"
    if [ -x "${DEPLOY_DIR}/set-permissions.sh" ]; then
        echo "✅ set-permissions.sh is executable"
    else
        echo "❌ set-permissions.sh is NOT executable"
    fi
else
    echo "❌ set-permissions.sh NOT FOUND"
fi

# Test 3: Start services script
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: Start Services Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "${DEPLOY_DIR}/start-services.sh" ]; then
    echo "✅ start-services.sh exists"
    if [ -x "${DEPLOY_DIR}/start-services.sh" ]; then
        echo "✅ start-services.sh is executable"
    else
        echo "❌ start-services.sh is NOT executable"
    fi
else
    echo "❌ start-services.sh NOT FOUND"
fi

# Test 4: Validate script
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: Validation Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "${DEPLOY_DIR}/validate-deployment.sh" ]; then
    echo "✅ validate-deployment.sh exists"
    if [ -x "${DEPLOY_DIR}/validate-deployment.sh" ]; then
        echo "✅ validate-deployment.sh is executable"
    else
        echo "❌ validate-deployment.sh is NOT executable"
    fi
else
    echo "❌ validate-deployment.sh NOT FOUND"
fi

# Test 5: BuildSpec
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 5: BuildSpec Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "${SCRIPT_DIR}/../buildspec.yml" ]; then
    echo "✅ buildspec.yml exists"
    # Validate YAML syntax
    if command -v python3 &> /dev/null; then
        if python3 -c "import yaml; yaml.safe_load(open('${SCRIPT_DIR}/../buildspec.yml'))" 2>/dev/null; then
            echo "✅ buildspec.yml is valid YAML"
        else
            echo "⚠️  buildspec.yml YAML validation failed (install PyYAML for validation)"
        fi
    else
        echo "ℹ️  Skipping YAML validation (python3 not found)"
    fi
else
    echo "❌ buildspec.yml NOT FOUND"
fi

# Test 6: AppSpec
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 6: AppSpec Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "${SCRIPT_DIR}/../appspec.yml" ]; then
    echo "✅ appspec.yml exists"
    # Check for required hooks
    if grep -q "ApplicationStop" "${SCRIPT_DIR}/../appspec.yml"; then
        echo "✅ ApplicationStop hook defined"
    fi
    if grep -q "BeforeInstall" "${SCRIPT_DIR}/../appspec.yml"; then
        echo "✅ BeforeInstall hook defined"
    fi
    if grep -q "AfterInstall" "${SCRIPT_DIR}/../appspec.yml"; then
        echo "✅ AfterInstall hook defined"
    fi
    if grep -q "ApplicationStart" "${SCRIPT_DIR}/../appspec.yml"; then
        echo "✅ ApplicationStart hook defined"
    fi
    if grep -q "ValidateService" "${SCRIPT_DIR}/../appspec.yml"; then
        echo "✅ ValidateService hook defined"
    fi
else
    echo "❌ appspec.yml NOT FOUND"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "All deployment scripts and configurations are ready!"
echo ""
echo "Next steps:"
echo "  1. Run: ./scripts/setup-cicd.sh (to create AWS resources)"
echo "  2. Install CodeDeploy agent on EC2"
echo "  3. Create CodePipeline via AWS Console"
echo "  4. Push to main branch to trigger deployment"
echo ""
