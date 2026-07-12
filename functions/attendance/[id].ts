import { formatMeetingDate, countAttendanceResponses, type Attendance } from 'shared/dist'

const API_URL = 'https://ballot-app-server.siener.workers.dev/api'

function isBot(userAgent: string): boolean {
  const botPatterns = [
    'facebookexternalhit',
    'Facebot',
    'Twitterbot',
    'LinkedInBot',
    'Slackbot',
    'TelegramBot',
    'WhatsApp',
    'Discordbot',
    'googlebot',
    'bingbot',
    'yandex',
    'baiduspider',
    'duckduckbot',
  ]
  return botPatterns.some(pattern =>
    userAgent.toLowerCase().includes(pattern.toLowerCase())
  )
}

export const onRequest: PagesFunction = async (context) => {
  const { request, params, next } = context
  const userAgent = request.headers.get('user-agent') || ''

  // Only intercept for bots/crawlers
  if (!isBot(userAgent)) {
    // For non-bots, serve the SPA
    return next()
  }

  const attendanceId = params.id as string

  try {
    // Fetch attendance data from API
    const response = await fetch(`${API_URL}/attendance/${attendanceId}`)

    if (!response.ok) {
      return next()
    }

    const attendance: Attendance = await response.json()

    const { yes: yesCount, no: noCount, total: totalResponses } = countAttendanceResponses(attendance)

    const title = `${attendance.title} - Attendance`
    const description = `${formatMeetingDate(attendance.date, 'full')} | ${yesCount} attending, ${noCount} not attending (${totalResponses} responses)`
    const url = `https://ballot.io/attendance/${attendance.id}`

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:site_name" content="Ballot.io" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:url" content="${url}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />

    <meta http-equiv="refresh" content="0;url=${url}" />
  </head>
  <body>
    <p>Loading attendance...</p>
  </body>
</html>`

    return new Response(html, {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
      },
    })
  } catch (error) {
    console.error('Error fetching attendance for unfurl:', error)
    return next()
  }
}
