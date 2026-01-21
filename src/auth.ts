/**
 * OAuth2 Authorization Helper
 * 
 * This script provides the initial refresh token for Gmail API access.
 * Run (npm run auth) to authorize the app. The refresh token will be stored in .env.
 * 
 */

import { google } from 'googleapis';
import { createServer } from 'http';
import { parse } from 'url';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import open from 'open';
import 'dotenv/config';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
];

const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

async function getRefreshToken() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Error: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env file');
    console.error('Please follow the instructions in .env.example to set up OAuth2 credentials');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI
  );

  // Generate authorization URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent screen to get refresh token
  });

  console.log('Opening browser for authorization...');
  console.log('If the browser doesn\'t open, visit this URL:');
  console.log(authUrl);
  console.log('');

  // Open browser
  await open(authUrl);

  // Start local server to receive callback
  return new Promise<string>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const queryParams = parse(req.url!, true).query;
        const code = queryParams.code as string;

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body>
                <h1>Authorization successful!</h1>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);

          // Exchange code for tokens
          const { tokens } = await oauth2Client.getToken(code);
          
          if (!tokens.refresh_token) {
            reject(new Error('No refresh token received. Make sure you selected "consent" and authorized all requested scopes.'));
            return;
          }

          server.close();
          resolve(tokens.refresh_token);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Authorization failed. No code received.');
          server.close();
          reject(new Error('No authorization code received'));
        }
      } catch (error) {
        server.close();
        reject(error);
      }
    });

    server.listen(3000, () => {
      console.log('Waiting for authorization callback on http://localhost:3000/oauth2callback');
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timeout. Please try again.'));
    }, 5 * 60 * 1000);
  });
}

async function main() {
  try {
    const refreshToken = await getRefreshToken();

    // Update .env file
    let envContent = '';
    if (existsSync('.env')) {
      envContent = readFileSync('.env', 'utf-8');
    }

    // Update or add GMAIL_REFRESH_TOKEN
    const lines = envContent.split('\n');
    let found = false;
    const updatedLines = lines.map(line => {
      if (line.startsWith('GMAIL_REFRESH_TOKEN=')) {
        found = true;
        return `GMAIL_REFRESH_TOKEN=${refreshToken}`;
      }
      return line;
    });

    if (!found) {
      updatedLines.push(`GMAIL_REFRESH_TOKEN=${refreshToken}`);
    }

    writeFileSync('.env', updatedLines.join('\n'));

    console.log('');
    console.log('✅ Success! Refresh token saved to .env file');
    console.log('You can now use the MCP server with your Gmail account.');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

