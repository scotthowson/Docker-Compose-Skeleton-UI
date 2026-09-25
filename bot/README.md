# DCS Discord bot

Slash commands for a Docker Compose Skeleton server, separate from the notification
webhook (which the API posts to on its own).

Commands: `/status`, `/usage`, `/health`, `/containers [filter]`, `/stacks`, `/updates`,
`/container <name> <info|logs|start|stop|restart|recreate>`, `/stack <name> <info|start|stop|restart|update>`.
Commands that change the server are limited to the Discord user IDs in `DISCORD_ADMIN_IDS`.

The bot signs in to the DCS API with its own user (create one on the Users page), so it never
touches your sessions. Deploy it from the `discord-bot` template in DCS Manager; the image is
`ghcr.io/scotthowson/dcs-discord-bot`.

| Variable | Meaning |
| --- | --- |
| `DISCORD_BOT_TOKEN` | Bot token from the Discord developer portal (Bot → Reset Token) |
| `DISCORD_GUILD_ID` | Your server's ID; commands register there instantly (global registration can take an hour) |
| `DISCORD_ADMIN_IDS` | Comma-separated Discord user IDs allowed to start, stop, restart, recreate and update |
| `DCS_API_URL` | Where the API answers, e.g. `http://host.docker.internal:9876` |
| `DCS_BOT_USERNAME` / `DCS_BOT_PASSWORD` | The DCS user the bot signs in as (admin for the control commands) |
| `DCS_SERVER_NAME` | Shown in every message footer |
| `DCS_DASHBOARD_URL` | Optional link on every embed title |

Invite the bot with the `applications.commands` and `bot` scopes.
