#!/usr/bin/env node

/**
 * Simple test script to verify the MCP tools work
 * 
 * This script tests the Gmail service directly (bypassing MCP protocol)
 * to verify authentication and basic functionality work.
 * 
 * Usage: node test-tools.js
 */

import { google } from 'googleapis';
import 'dotenv/config';

async function testGmailConnection() {
  console.log('🔍 Testing Gmail API connection...\n');

  // Validate credentials
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    console.error('❌ Error: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set');
    process.exit(1);
  }

  if (!process.env.GMAIL_REFRESH_TOKEN) {
    console.error('❌ Error: GMAIL_REFRESH_TOKEN not found. Run "npm run auth" first');
    process.exit(1);
  }

  // Initialize OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    // Test 1: Get user profile (verifies authentication)
    console.log('1️⃣ Testing authentication...');
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log(`   ✅ Authenticated as: ${profile.data.emailAddress}`);
    console.log(`   ✅ Total messages: ${profile.data.messagesTotal}`);
    console.log(`   ✅ Total threads: ${profile.data.threadsTotal}\n`);

    // Test 2: Get unread emails
    console.log('2️⃣ Testing get_unread_emails...');
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 5,
    });

    const unreadCount = listResponse.data.messages?.length || 0;
    console.log(`   ✅ Found ${unreadCount} unread email(s)`);

    if (unreadCount > 0) {
      // Get details of first unread email
      const firstMessage = listResponse.data.messages[0];
      const messageResponse = await gmail.users.messages.get({
        userId: 'me',
        id: firstMessage.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject'],
      });

      const headers = messageResponse.data.payload?.headers || [];
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
      const subject = headers.find(h => h.name === 'Subject')?.value || '(No subject)';

      console.log(`   📧 Sample unread email:`);
      console.log(`      From: ${from}`);
      console.log(`      Subject: ${subject}`);
      console.log(`      Email ID: ${firstMessage.id}`);
      console.log(`      Thread ID: ${firstMessage.threadId}\n`);
    } else {
      console.log('   ℹ️  No unread emails to test with\n');
    }

    // Test 3: Verify we can access drafts (needed for create_draft_reply)
    console.log('3️⃣ Testing draft creation capability...');
    const draftsResponse = await gmail.users.drafts.list({
      userId: 'me',
      maxResults: 1,
    });
    console.log(`   ✅ Can access drafts (${draftsResponse.data.drafts?.length || 0} existing draft(s))\n`);

    console.log('✅ All tests passed! Your Gmail MCP server is ready to use.');
    console.log('\n📝 Next steps:');
    console.log('   1. Start the MCP server: npm start');
    console.log('   2. Configure your MCP client to use: node dist/index.js');
    console.log('   3. Test the tools through your MCP client\n');

  } catch (error) {
    console.error('\n❌ Error testing Gmail API:');
    if (error.code === 401) {
      console.error('   Authentication failed. Your refresh token may be invalid.');
      console.error('   Try running "npm run auth" again to get a new token.');
    } else if (error.code === 403) {
      console.error('   Permission denied. Make sure you authorized the required scopes:');
      console.error('   - gmail.readonly');
      console.error('   - gmail.compose');
      console.error('   Try running "npm run auth" again.');
    } else {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
}

testGmailConnection();

