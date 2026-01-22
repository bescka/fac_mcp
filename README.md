# Gmail MCP Server

An MCP (Model Context Protocol) server that enables AI assistants to read unread emails from Gmail and create draft replies.

## Quickstart

```bash
# Install dependencies
npm install

# Copy env template and add your Google OAuth2 credentials
cp .env.example .env

# Run the OAuth2 flow to get your refresh token
npm run auth

# Build and run
npm run build
npm start
```

Then configure the MCP client to use the server. See [Setup](#setup) for detailed instructions.

## Features

- **get_unread_emails**: Retrieves all unread emails with sender, subject, body/snippet, email ID, and thread ID
- **create_draft_reply**: Creates a properly threaded draft reply to any email
- **get_space_picture_of_the_day**: (Optional) Fetches NASA Astronomy Picture of the Day (APOD) and returns a ready-to-paste “Did you know? Space Edition!” section with clear credits/references. The AI should ask before including this.

### Architecture

1. **MCP Server (`src/index.ts`)**: Handles MCP protocol communication, tool registration, and request routing
2. **Gmail Service (`src/gmail.service.ts`)**: Encapsulates all Gmail API interactions

### Process Flow

#### Reading Unread Emails

1. **Query Gmail**: Uses Gmail API's `messages.list` with query `"is:unread"` to find all unread message IDs
2. **Fetch Details**: For each message ID, calls `messages.get` with `format: 'metadata'` to get headers and snippet
3. **Extract Information**: Parses headers to get `From` and `Subject`, uses `snippet` as the email body
4. **Return Structured Data**: Returns array of objects with `sender`, `subject`, `body`, `emailId`, and `threadId`

#### Creating Draft Replies

1. **Fetch Original**: Retrieves the original message using `messages.get` with `format: 'full'` to get all headers
2. **Extract Threading Info**: Gets `threadId`, `Message-ID`, `Subject`, and `From` headers from original
3. **Build Reply Email**: Constructs RFC 2822 formatted email with:
   - `To`: Original sender's email address
   - `Subject`: Original subject prefixed with "Re: " (if not already present)
   - `In-Reply-To`: Original Message-ID header
   - `References`: Original Message-ID header (for threading)
   - Body: The provided reply text
4. **Encode**: Base64url encodes the email (Gmail API requirement)
5. **Create Draft**: Calls `drafts.create` with the encoded email and `threadId` to maintain proper threading

### Email Threading

Email threading is maintained through:
- **threadId**: Links the draft to the original email thread
- **In-Reply-To header**: Points to the original message's Message-ID
- **References header**: Contains the original Message-ID for email client compatibility

This ensures the draft appears as a reply in Gmail and maintains the conversation thread.

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Gmail API**:
   - Copy `.env.example` to `.env`
   - Follow the instructions in `.env.example` to set up OAuth2 credentials
   - Fill in `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` from Google Cloud Console
   - Run `npm run auth` to get your refresh token (one-time setup)
   - The refresh token will be automatically saved to your `.env` file

3. **Build**:
   ```bash
   npm run build
   ```

4. **Run**:
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

## Testing

Run tests with:
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```


### Claude Code (CLI) (for Linux)

Add the MCP server to Claude Code settings at `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "gmail": {
      "command": "node",
      "args": [
        "/absolute/path/to/fac_mcp/dist/index.js"
      ]
    }
  }
}
```

Once configured, the Gmail tools will be available in Claude Code sessions.

**Note:** The server automatically loads credentials from `.env` file

The server exposes two tools:
- `get_unread_emails`: No parameters, returns array of unread emails
- `create_draft_reply`: Requires `emailId` (string) and `replyBody` (string). Optional `format: "html"` to create an HTML draft.

### Optional Space Extension (NASA APOD)

If enabled, the server also exposes:
- `get_space_picture_of_the_day`: Optional params `date` (YYYY-MM-DD) and `maxDaysBack` (defaults to 10, max 30). If today’s APOD fails, it automatically tries previous days.

**Opt-in flow:**
- The AI should ask: “Would you like to include a ‘Did you know? Space Edition!’ section with today’s NASA picture of the day?”
- If you say yes, it calls `get_space_picture_of_the_day` and appends `spaceEditionBlock` (plain) or `spaceEditionBlockHtml` (HTML) after the normal reply.
- If using `spaceEditionBlockHtml`, call `create_draft_reply` with `format: "html"` so Gmail renders the image.

### Space Extension Configuration

Environment variables:
- `ENABLE_SPACE_PICTURE_OF_THE_DAY`: Optional. Defaults to `true`. Set to `false` to hide/disable the space tools entirely.
- `NASA_API_KEY`: Optional. Defaults to `DEMO_KEY`, which works with rate limiting. Get a free key from `https://api.nasa.gov/`.

## Screenshots

<img width="650" alt="image" src="https://github.com/user-attachments/assets/d16bc0d7-f173-4a43-af98-a705f482d8fb" />

<img width="450" alt="image" src="https://github.com/user-attachments/assets/c7af8084-9606-4169-a7fc-16c79d905de7" />

with the APOD extension: 

<img width="1089" height="862" alt="image" src="https://github.com/user-attachments/assets/9bd36951-e925-4abc-bc86-db97b8119869" />

draft extract: 

<img width="1029" height="1062" alt="image" src="https://github.com/user-attachments/assets/4987d1cf-a86f-4961-a735-2473860b2a84" />


## Known Issues

### Security Vulnerability

There is a known ReDoS (Regular Expression Denial of Service) vulnerability in `@modelcontextprotocol/sdk` (GHSA-8r9q-7v3j-jr4g / CVE-2026-0621). The project uses the latest version of the SDK (1.25.1). 

**Impact**: This is a denial-of-service vulnerability only - it could potentially make the server slow or unresponsive if malicious input is processed, but it **does not** allow unauthorized access, data exfiltration, or privilege escalation. The risk is relatively low for this MCP server since it runs locally via stdio and doesn't expose a network interface.


