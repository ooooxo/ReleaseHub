# 字体改用系统字体栈，弃 Google Fonts CDN

原先字体（Fraunces / Outfit / Source Sans 3 / IBM Plex Mono）全部经 `index.html` 的 Google Fonts CDN 加载，且正文无任何 CJK 字体。作为自部署服务，部署环境常在中国大陆 / 内网 / 离线，Google Fonts 经常不可达或极慢，导致字体加载失败、全部回退系统默认；叠加正文零 CJK 字体，中英混排断层——这是「字体差」的双重根因。

决定：放弃 CDN webfont，正文与等宽全部改用系统字体栈（拉丁 + CJK 一套混排栈：`-apple-system, 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', 'Noto Sans SC', system-ui`；等宽 `ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace`），数字一律 `tabular-nums`。零外部依赖、任何机器立即可用、中英不断层，也与 morii 的 `system-ui` 取向一致。

## Consequences

- 跨机字形会有差异（各系统自带字体不同），这是用可达性 + 中英一致性换来的取舍，接受。
- 若日后确需个性 display 字体，方案是自托管 woff2 子集（拉丁子集小），不得退回 CDN。
