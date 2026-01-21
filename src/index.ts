import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { google } from 'googleapis';
import { GmailService } from './gmail.service.js';
import 'dotenv/config';

/**
 * MCP Server for Gmail Integration
 * 
 * This server provides two tools to AI assistants:
 * 1. get_unread_emails - Reads unread emails from Gmail
 * 2. create_draft_reply - Creates a draft reply to an email
 * 
 * Process flow:
 * 1. Server starts and authenticates with Gmail API using OAuth2 (refresh token)
 * 2. Registers tools with the MCP protocol
 * 3. Handles tool calls from AI assistants
 * 4. Delegates to GmailService for actual Gmail API interactions
 * 
 * Authentication:
 * - Uses OAuth2 flow for personal Gmail accounts
 * - Requires initial authorization (run `npm run auth` once)
 * - Refresh token is stored in .env file and used for subsequent requests
 */

function validateEnvironment(): void {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    console.error('Error: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env file');
    console.error('Please follow the instructions in .env.example to set up OAuth2 credentials');
    process.exit(1);
  }

  if (!process.env.GMAIL_REFRESH_TOKEN) {
    console.error('Error: GMAIL_REFRESH_TOKEN not found in .env file');
    console.error('Run "npm run auth" to get your refresh token');
    process.exit(1);
  }
}

function createGmailService(): GmailService {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  const gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });
  return new GmailService(gmailClient);
}

function createMCPServer(): Server {
  return new Server(
    {
      name: 'gmail-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
}

/**
 * Formats a response for MCP protocol.
 * 
 * @param data - The data to return
 * @param isError - Whether this is an error response
 * @returns Formatted MCP response
 */
function createMCPResponse(data: unknown, isError = false) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
    ...(isError && { isError: true }),
  };
}

/**
 * Registers all tools with the MCP server.
 * 
 * @param server - The MCP server instance
 * @param gmailService - The Gmail service instance
 */
function registerTools(server: Server, gmailService: GmailService): void {
  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_unread_emails',
          description:
            'Retrieves all unread emails from the Gmail account. Returns sender, subject, body/snippet, email ID, and thread ID for each unread email.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'create_draft_reply',
          description:
            'Creates a draft reply to an existing email. Maintains proper email threading by linking to the original message.',
          inputSchema: {
            type: 'object',
            properties: {
              emailId: {
                type: 'string',
                description:
                  'The ID of the email to reply to (from get_unread_emails)',
              },
              replyBody: {
                type: 'string',
                description: 'The body text of the reply',
              },
            },
            required: ['emailId', 'replyBody'],
          },
        },
      ],
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'get_unread_emails': {
          const emails = await gmailService.getUnreadEmails();
          return createMCPResponse(emails);
        }

        case 'create_draft_reply': {
          const { emailId, replyBody } = args as {
            emailId: string;
            replyBody: string;
          };

          if (!emailId || !replyBody) {
            throw new Error('emailId and replyBody are required');
          }

          const result = await gmailService.createDraftReply(
            emailId,
            replyBody
          );
          return createMCPResponse({
            success: true,
            draftId: result.draftId,
            threadId: result.threadId,
            message: 'Draft reply created successfully',
          });
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return createMCPResponse({ error: errorMessage }, true);
    }
  });
}

/**
 * Initialize and start the MCP server.
 */
async function main(): Promise<void> {
  validateEnvironment();

  const gmailService = createGmailService();

  const server = createMCPServer();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  registerTools(server, gmailService);

  console.error('Gmail MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

