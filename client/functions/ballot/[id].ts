/**
 * Cloudflare Pages Function to handle Open Graph meta tags for ballot URLs
 * This enables rich unfurling in Slack, Twitter, Discord, etc.
 */

interface Env {
  // No additional bindings needed - we'll use fetch to call the API
}

const API_URL = 'https://ballot-app-server.siener.workers.dev/api/ballots';

// Detect if the request is from a bot/crawler
function isBot(userAgent: string): boolean {
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

function generateOGHtml(ballot: any): string {
  const voteCount = ballot.votes?.length || 0;
  const greenVotes = ballot.votes?.filter((v: any) => v.color === 'green').length || 0;
  const yellowVotes = ballot.votes?.filter((v: any) => v.color === 'yellow').length || 0;
  const redVotes = ballot.votes?.filter((v: any) => v.color === 'red').length || 0;

  const description = `${voteCount} total votes • 🟢 ${greenVotes} 🟡 ${yellowVotes} 🔴 ${redVotes}`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://ballot.io/ballot/${ballot.id}" />
    <meta property="og:title" content="${escapeHtml(ballot.question)}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:site_name" content="Ballot.io" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:url" content="https://ballot.io/ballot/${ballot.id}" />
    <meta name="twitter:title" content="${escapeHtml(ballot.question)}" />
    <meta name="twitter:description" content="${description}" />

    <title>${escapeHtml(ballot.question)}</title>

    <!-- Redirect to actual app after meta tags are read -->
    <meta http-equiv="refresh" content="0;url=https://ballot.io/ballot/${ballot.id}" />
  </head>
  <body>
    <h1>${escapeHtml(ballot.question)}</h1>
    <p>${description}</p>
    <p>Redirecting to ballot...</p>
  </body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m] || m);
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params } = context;
  const ballotId = params.id as string;
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
};
