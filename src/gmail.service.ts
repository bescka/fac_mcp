import { gmail_v1 } from 'googleapis';

export class GmailService {
  private gmail: gmail_v1.Gmail;

  constructor(gmailClient: gmail_v1.Gmail) {
    this.gmail = gmailClient;
  }

  /**
   * Retrieves all unread emails from the Gmail account.
   * 
   * 1. Uses Gmail API's messages.list with query "is:unread" to find unread message IDs
   * 2. For each message ID, fetches message metadata (headers and snippet)
   * 3. Extracts From, Subject headers and uses snippet as body
   * 4. Returns structured data with sender, subject, body, emailId, and threadId
   */
  async getUnreadEmails(): Promise<
    Array<{
      sender: string;
      subject: string;
      body: string;
      emailId: string;
      threadId: string;
    }>
  > {
    // List all unread messages
    const listResponse = await this.gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
    });

    const messages = listResponse.data.messages || [];

    if (messages.length === 0) {
      return [];
    }

    // Fetch full details for each message
    const emailPromises = messages.map(async (message) => {
      const messageResponse = await this.gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject'],
      });

      const msg = messageResponse.data;
      const headers = msg.payload?.headers || [];

      // Extract headers
      const fromHeader = headers.find((h) => h.name === 'From')?.value || '';
      const subjectHeader = headers.find((h) => h.name === 'Subject')?.value || '';

      // Use snippet as body (Gmail provides this automatically)
      const body = msg.snippet || '';

      return {
        sender: fromHeader,
        subject: subjectHeader,
        body: body,
        emailId: msg.id!,
        threadId: msg.threadId!,
      };
    });

    return Promise.all(emailPromises);
  }

  /**
   * Creates a draft reply to an existing email with proper threading.
   * 
   * 1. Fetches the original message to get threading information (threadId, Message-ID, Subject)
   * 2. Constructs a properly formatted email with:
   *    - In-Reply-To header pointing to original Message-ID
   *    - References header for email threading
   *    - Subject prefixed with "Re: " (if not already present)
   *    - To field set to original sender
   * 3. Encodes the email in RFC 2822 format and base64url encodes it
   * 4. Creates a draft using Gmail API with the threadId to maintain threading
   */
  async createDraftReply(
    emailId: string,
    replyBody: string
  ): Promise<{ draftId: string; threadId: string }> {
    // Fetch original message for threading info
    const originalMessage = await this.gmail.users.messages.get({
      userId: 'me',
      id: emailId,
      format: 'full',
    });

    const msg = originalMessage.data;
    const headers = msg.payload?.headers || [];

    const fromHeader = headers.find((h) => h.name === 'From')?.value || '';
    const subjectHeader = headers.find((h) => h.name === 'Subject')?.value || '';
    const messageIdHeader = headers.find((h) => h.name === 'Message-ID')?.value || '';

    const threadId = msg.threadId!;

    // Construct reply subject (add "Re: " if not present)
    const replySubject = subjectHeader.startsWith('Re: ')
      ? subjectHeader
      : `Re: ${subjectHeader}`;

    // Build email in RFC 2822 format
    // Extract email address from "Name <email@example.com>" format
    const toEmail = fromHeader.includes('<')
      ? fromHeader.match(/<(.+)>/)?.[1] || fromHeader
      : fromHeader;

    const emailLines: string[] = [];
    emailLines.push(`To: ${toEmail}`);
    emailLines.push(`Subject: ${replySubject}`);
    
    if (messageIdHeader) {
      emailLines.push(`In-Reply-To: ${messageIdHeader}`);
      emailLines.push(`References: ${messageIdHeader}`);
    }

    emailLines.push('Content-Type: text/plain; charset=utf-8');
    emailLines.push(''); // Empty line separates headers from body
    emailLines.push(replyBody);

    const rawEmail = emailLines.join('\r\n');

    // Base64url encode (Gmail requires base64url, not base64)
    const encodedEmail = Buffer.from(rawEmail)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''); // Remove padding

    // Create draft with threadId for proper threading
    const draftResponse = await this.gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          threadId: threadId,
          raw: encodedEmail,
        },
      },
    });

    return {
      draftId: draftResponse.data.id!,
      threadId: threadId,
    };
  }
}

