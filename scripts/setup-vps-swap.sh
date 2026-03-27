#!/bin/bash
# ============================================
# VPS Swap 設定スクリプト
# 1.9GB メモリの VPS に 2GB swap を追加
# ============================================
#
# 使い方:
#   ssh ubuntu@133.125.38.92
#   sudo bash /opt/app/scripts/setup-vps-swap.sh
#
# Docker build 時のOOM防止が目的。
# 既に swap がある場合はスキップ。

set -euo pipefail

SWAP_FILE="/swapfile"
SWAP_SIZE="2G"

if swapon --show | grep -q "${SWAP_FILE}"; then
  echo "Swap already exists:"
  swapon --show
  exit 0
fi

echo "=== Setting up ${SWAP_SIZE} swap ==="

# 1. Create swap file
echo "[1/4] Creating swap file..."
sudo fallocate -l ${SWAP_SIZE} ${SWAP_FILE}
sudo chmod 600 ${SWAP_FILE}

# 2. Make swap
echo "[2/4] Making swap..."
sudo mkswap ${SWAP_FILE}

# 3. Enable swap
echo "[3/4] Enabling swap..."
sudo swapon ${SWAP_FILE}

# 4. Persist across reboot
echo "[4/4] Adding to /etc/fstab..."
if ! grep -q "${SWAP_FILE}" /etc/fstab; then
  echo "${SWAP_FILE} none swap sw 0 0" | sudo tee -a /etc/fstab
fi

echo ""
echo "=== Swap setup complete ==="
free -h
swapon --show
