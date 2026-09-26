# DCS Discord brand kit

Artwork for everything DCS shows on Discord, drawn from the app icon's language: the isometric
compose stack on deep slate, emerald for what runs, cyan for the network.

| File | Use | Where it goes |
| --- | --- | --- |
| `app-icon.png` | The DCS Manager application (Rich Presence) and the author icon on every embed | Developer portal → application → General Information → App Icon |
| `bot-avatar.png` | The bot: the stack with a slash-command badge | Developer portal → Bot → Avatar |
| `bot-banner.png` | Profile banner (1360×480) | Developer portal → Bot → Banner |
| `webhook-avatar.png` | Notification posts: the stack with a bell | Used automatically (`DISCORD_WEBHOOK_AVATAR` overrides); also fine as the webhook's avatar in Discord |
| `crowdsec-avatar.png` | CrowdSec alerts: the stack inside a shield | Used automatically by the alert template |
| `presence-dcs.png` | Rich Presence large image | Rich Presence → Art Assets, key `dcs` |
| `presence-healthy.png` | Rich Presence small image, all good | key `healthy` |
| `presence-warning.png` | Rich Presence small image, something needs a look | key `warning` |

`render.sh` rebuilds every PNG from the SVG sources (needs `rsvg-convert`). The API and the bot load
the PNGs from this folder on the `v2.0.0` branch, so keep the file names.
