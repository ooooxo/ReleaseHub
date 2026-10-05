#!/usr/bin/env bash
# 本地起一份 release-server 做手测：先构建前端，数据目录全放沙箱，不碰仓库里的 releases/ 等。
# 跑法：bash scripts/dev-local.sh   （前台运行，Ctrl-C 停；重复跑沿用同一沙箱）
# 需要：node、已 npm install（根目录与 frontend/）。登录密码默认 rainy。
# 注意：.meta/ 与 .notes-cache/ 写死在仓库根、不走沙箱，测完自行清掉。
set -euo pipefail

SANDBOX="${SANDBOX:-/tmp/releasehub-dev}"
PORT="${PORT:-3721}"

cd "$(dirname "$0")/.."
mkdir -p "$SANDBOX"/{releases,resource-libraries,temp-transfers,incomplete}
(cd frontend && VITE_BASE=/ npm run build)   # 生产默认 /releasehub/ 前缀，本地直连 Node 用根路径

export PORT
export BASE_URL="http://localhost:$PORT"
export RELEASES_DIR="$SANDBOX/releases"
export RESOURCE_LIBRARIES_DIR="$SANDBOX/resource-libraries"
export TEMP_TRANSFER_DIR="$SANDBOX/temp-transfers"
export UPLOADS_INCOMPLETE_DIR="$SANDBOX/incomplete"
exec node server.js
