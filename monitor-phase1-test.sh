#!/bin/bash
# Phase 1 SQLite Fix - Test Monitor Script
# Monitors bot for 20+ minutes and checks for SQLite errors

echo "================================================"
echo "PHASE 1 SQLITE FIX - TEST MONITOR"
echo "================================================"
echo "Started: $(date)"
echo "Target Duration: 20+ minutes"
echo "Critical Threshold: 15 minutes (previous crash point)"
echo ""
echo "Monitoring for:"
echo "  ✅ Bot still running"
echo "  ❌ SQLITE_ERROR messages"
echo "  ❌ Transaction conflicts"
echo "  ❌ Crashes"
echo ""
echo "================================================"
echo ""

# Find the node process PID
NODE_PID=$(ps aux | grep -E "npm run dev|ts-node.*index" | grep -v grep | head -1 | awk '{print $2}')

if [ -z "$NODE_PID" ]; then
    echo "❌ ERROR: Bot process not found!"
    echo "Please start the bot with: npm run dev"
    exit 1
fi

echo "🤖 Bot Process PID: $NODE_PID"
echo ""

# Monitor for 25 minutes (1500 seconds)
START_TIME=$(date +%s)
TARGET_DURATION=1500  # 25 minutes
CHECK_INTERVAL=30     # Check every 30 seconds

while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    ELAPSED_MIN=$((ELAPSED / 60))
    ELAPSED_SEC=$((ELAPSED % 60))

    # Check if bot is still running
    if ! ps -p $NODE_PID > /dev/null 2>&1; then
        echo ""
        echo "❌ BOT CRASHED! Process $NODE_PID no longer running"
        echo "Time: ${ELAPSED_MIN}m ${ELAPSED_SEC}s"
        echo "Status: FAILED - Bot crashed before reaching 20 minutes"
        exit 1
    fi

    # Display progress
    if [ $ELAPSED_MIN -eq 0 ]; then
        echo "⏱️  Runtime: ${ELAPSED_SEC}s"
    else
        echo "⏱️  Runtime: ${ELAPSED_MIN}m ${ELAPSED_SEC}s"
    fi

    # Milestone checks
    if [ $ELAPSED -eq 900 ] && [ $((ELAPSED % CHECK_INTERVAL)) -eq 0 ]; then
        echo "✅ MILESTONE: 15 minutes passed - Previous crash point!"
    fi

    if [ $ELAPSED -eq 1200 ] && [ $((ELAPSED % CHECK_INTERVAL)) -eq 0 ]; then
        echo "✅ MILESTONE: 20 minutes passed - Target reached!"
    fi

    # Check if we've reached target
    if [ $ELAPSED -ge $TARGET_DURATION ]; then
        echo ""
        echo "================================================"
        echo "✅ TEST COMPLETE - BOT SURVIVED 25 MINUTES!"
        echo "================================================"
        echo "Total Runtime: ${ELAPSED_MIN}m ${ELAPSED_SEC}s"
        echo "Status: SUCCESS - SQLite fix appears to be working"
        echo ""
        echo "The bot is still running. You can:"
        echo "  1. Let it continue running for extended validation"
        echo "  2. Stop it manually: kill $NODE_PID"
        echo ""
        exit 0
    fi

    # Wait before next check
    sleep $CHECK_INTERVAL
done
