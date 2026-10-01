Deployment of the Ageing Navigator pilot (staging: fictional data only until the client's own database is used).

  Vercel project: ageing-navigator-pilot (team servi-tec), linked in .vercel/project.json
  Address:        https://ageing-navigator-pilot.vercel.app (attach once: vercel domains add ageing-navigator-pilot.vercel.app ageing-navigator-pilot --scope servi-tec)
  Deploy:         ./deploy.sh   (deploys demo/ from the committed HEAD of this repository)

Environment variables live in Vercel (names only here): AUTH_SECRET, CRON_SECRET, APP_URL, and DATABASE_URL once
the staging database exists. Not set on staging: RESEND_API_KEY (no email is sent; navigators copy the link) and
REQUIRE_APPROVED_CONTENT (set it to 1 on the real production only). Set a value without echoing it:
  printf '%s' "$VALUE" | vercel env add NAME production --scope servi-tec
