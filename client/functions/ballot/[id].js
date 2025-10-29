/**
 * Cloudflare Pages Function to handle Open Graph meta tags for ballot URLs
 * This enables rich unfurling in Slack, Twitter, Discord, etc.
 */

const API_URL = 'https://ballot-app-server.siener.workers.dev/api/ballots';

// Detect if the request is from a bot/crawler
function isBot(userAgent) {
  const botPatterns = [
    'Slackbot',
    'Twitterbot',
    'facebookexternalhit',
    'LinkedInBot',
    'WhatsApp',
    'TelegramBot',
    'Discordbot',
    'Slack-ImgProxy',
  ];

  return botPatterns.some(pattern =>
    userAgent.toLowerCase().includes(pattern.toLowerCase())
  );
}

function generateOGHtml(ballot) {
  const voteCount = ballot.votes?.length || 0;
  const greenVotes = ballot.votes?.filter(v => v.color === 'green').length || 0;
  const yellowVotes = ballot.votes?.filter(v => v.color === 'yellow').length || 0;
  const redVotes = ballot.votes?.filter(v => v.color === 'red').length || 0;

  const description = `${voteCount} total vote${voteCount !== 1 ? 's' : ''} • ✅ ${greenVotes} ⚠️ ${yellowVotes} ❌ ${redVotes}`;

  // Generate a simple visual representation for Slack/social
  const ballotUrl = `https://ballot.io/${ballot.id}`;
  const imageUrl = `https://ballot.io/vite.svg`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${ballotUrl}" />
    <meta property="og:title" content="${escapeHtml(ballot.question)}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:site_name" content="Ballot" />
    <meta property="og:image" content="${imageUrl}" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${ballotUrl}" />
    <meta name="twitter:title" content="${escapeHtml(ballot.question)}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />

    <!-- Slack-specific -->
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <title>${escapeHtml(ballot.question)} - Ballot</title>

    <!-- Redirect to actual app after meta tags are read -->
    <meta http-equiv="refresh" content="0;url=${ballotUrl}" />
  </head>
  <body>
    <h1>${escapeHtml(ballot.question)}</h1>
    <p>${description}</p>
    <p>Redirecting to ballot...</p>
  </body>
</html>`;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m] || m);
}

export async function onRequest(context) {
  const { request, params } = context;
  const ballotId = params.id;
  const userAgent = request.headers.get('User-Agent') || '';

  // Only generate OG tags for bots/crawlers
  if (!isBot(userAgent)) {
    // Let the SPA handle it for regular users
    return context.next();
  }

  try {
    // Fetch ballot data from API
    const response = await fetch(`${API_URL}/${ballotId}`);

    if (!response.ok) {
      // Ballot not found, let the SPA handle the 404
      return context.next();
    }

    const ballot = await response.json();

    // Return HTML with Open Graph meta tags
    return new Response(generateOGHtml(ballot), {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error('Error generating OG tags:', error);
    // On error, let the SPA handle it
    return context.next();
  }
}
