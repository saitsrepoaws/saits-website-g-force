#!/bin/bash

###############################################################################
# POST-SANDBOX DEPLOYMENT HOOK
# Automatically syncs amplify_outputs.json to frontend after each deployment
###############################################################################

# Run from project root
cd "$(dirname "$0")/../.."

# Sync config to frontend
./scripts/sync-amplify-config.sh

exit 0
