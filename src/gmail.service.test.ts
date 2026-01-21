import { GmailService } from './gmail.service';
import { gmail_v1 } from 'googleapis';

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    gmail: jest.fn(() => ({
      users: {
        messages: {
          list: jest.fn(),
          get: jest.fn(),
        },
        drafts: {
          create: jest.fn(),
        },
      },
    })),
  },
}));

describe('GmailService', () => {
  let gmailService: GmailService;
  let mockGmailClient: any;

  beforeEach(() => {
    const { google } = require('googleapis');
    mockGmailClient = {
      users: {
        messages: {
          list: jest.fn(),
          get: jest.fn(),
        },
        drafts: {
          create: jest.fn(),
        },
      },
    };
    google.gmail.mockReturnValue(mockGmailClient);
    gmailService = new GmailService(mockGmailClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUnreadEmails', () => {
    it('should return empty array when no unread emails exist', async () => {
      mockGmailClient.users.messages.list.mockResolvedValue({
        data: {
          messages: [],
        },
      });

      const result = await gmailService.getUnreadEmails();
      expect(result).toEqual([]);
      expect(mockGmailClient.users.messages.list).toHaveBeenCalledWith({
        userId: 'me',
        q: 'is:unread',
      });
    });

    it('should return unread emails with sender, subject, body, and IDs', async () => {
      const mockMessageList = {
        data: {
          messages: [
            { id: 'msg1', threadId: 'thread1' },
            { id: 'msg2', threadId: 'thread2' },
          ],
        },
      };

      const mockMessage1 = {
        data: {
          id: 'msg1',
          threadId: 'thread1',
          snippet: 'This is a test email snippet...',
          payload: {
            headers: [
              { name: 'From', value: 'sender@example.com' },
              { name: 'Subject', value: 'Test Subject 1' },
            ],
          },
        },
      };

      const mockMessage2 = {
        data: {
          id: 'msg2',
          threadId: 'thread2',
          snippet: 'Another email snippet...',
          payload: {
            headers: [
              { name: 'From', value: 'another@example.com' },
              { name: 'Subject', value: 'Test Subject 2' },
            ],
          },
        },
      };

      mockGmailClient.users.messages.list.mockResolvedValue(mockMessageList);
      mockGmailClient.users.messages.get
        .mockResolvedValueOnce(mockMessage1)
        .mockResolvedValueOnce(mockMessage2);

      const result = await gmailService.getUnreadEmails();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        sender: 'sender@example.com',
        subject: 'Test Subject 1',
        body: 'This is a test email snippet...',
        emailId: 'msg1',
        threadId: 'thread1',
      });
      expect(result[1]).toEqual({
        sender: 'another@example.com',
        subject: 'Test Subject 2',
        body: 'Another email snippet...',
        emailId: 'msg2',
        threadId: 'thread2',
      });

      expect(mockGmailClient.users.messages.get).toHaveBeenCalledTimes(2);
      expect(mockGmailClient.users.messages.get).toHaveBeenCalledWith({
        userId: 'me',
        id: 'msg1',
        format: 'metadata',
        metadataHeaders: ['From', 'Subject'],
      });
    });

    it('should handle emails with full body when snippet is not available', async () => {
      const mockMessageList = {
        data: {
          messages: [{ id: 'msg1', threadId: 'thread1' }],
        },
      };

      const mockMessage = {
        data: {
          id: 'msg1',
          threadId: 'thread1',
          snippet: '',
          payload: {
            headers: [
              { name: 'From', value: 'sender@example.com' },
              { name: 'Subject', value: 'Test Subject' },
            ],
            body: {
              data: Buffer.from('Full email body content').toString('base64'),
            },
          },
        },
      };

      mockGmailClient.users.messages.list.mockResolvedValue(mockMessageList);
      mockGmailClient.users.messages.get.mockResolvedValue(mockMessage);

      const result = await gmailService.getUnreadEmails();

      expect(result[0].body).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      mockGmailClient.users.messages.list.mockRejectedValue(
        new Error('API Error')
      );

      await expect(gmailService.getUnreadEmails()).rejects.toThrow('API Error');
    });
  });

  describe('createDraftReply', () => {
    it('should create a draft reply with correct threading', async () => {
      const mockOriginalMessage = {
        data: {
          id: 'msg1',
          threadId: 'thread1',
          payload: {
            headers: [
              { name: 'From', value: 'original@example.com' },
              { name: 'Subject', value: 'Original Subject' },
              { name: 'Message-ID', value: '<original-message-id>' },
            ],
          },
        },
      };

      const mockDraftResponse = {
        data: {
          id: 'draft1',
          message: {
            id: 'draft-msg1',
            threadId: 'thread1',
          },
        },
      };

      mockGmailClient.users.messages.get.mockResolvedValue(mockOriginalMessage);
      mockGmailClient.users.drafts.create.mockResolvedValue(mockDraftResponse);

      const result = await gmailService.createDraftReply(
        'msg1',
        'This is my reply'
      );

      expect(result).toEqual({
        draftId: 'draft1',
        threadId: 'thread1',
      });

      // Verify the draft was created with correct threading
      expect(mockGmailClient.users.drafts.create).toHaveBeenCalledWith({
        userId: 'me',
        requestBody: {
          message: {
            threadId: 'thread1',
            raw: expect.any(String), // Base64 encoded email
          },
        },
      });

      // Verify the raw email contains the reply structure
      const createCall = mockGmailClient.users.drafts.create.mock.calls[0][0];
      // Decode base64url: convert back to base64 format
      const base64url = createCall.requestBody.message.raw;
      const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      const padding = base64.length % 4;
      const paddedBase64 = base64 + (padding ? '='.repeat(4 - padding) : '');
      const rawMessage = Buffer.from(paddedBase64, 'base64').toString();
      expect(rawMessage).toContain('In-Reply-To: <original-message-id>');
      expect(rawMessage).toContain('References: <original-message-id>');
      expect(rawMessage).toContain('This is my reply');
    });

    it('should handle missing original message', async () => {
      mockGmailClient.users.messages.get.mockRejectedValue(
        new Error('Message not found')
      );

      await expect(
        gmailService.createDraftReply('invalid-id', 'Reply text')
      ).rejects.toThrow('Message not found');
    });

    it('should handle draft creation errors', async () => {
      const mockOriginalMessage = {
        data: {
          id: 'msg1',
          threadId: 'thread1',
          payload: {
            headers: [
              { name: 'From', value: 'original@example.com' },
              { name: 'Subject', value: 'Original Subject' },
              { name: 'Message-ID', value: '<original-message-id>' },
            ],
          },
        },
      };

      mockGmailClient.users.messages.get.mockResolvedValue(mockOriginalMessage);
      mockGmailClient.users.drafts.create.mockRejectedValue(
        new Error('Draft creation failed')
      );

      await expect(
        gmailService.createDraftReply('msg1', 'Reply text')
      ).rejects.toThrow('Draft creation failed');
    });

    it('should preserve original subject with Re: prefix', async () => {
      const mockOriginalMessage = {
        data: {
          id: 'msg1',
          threadId: 'thread1',
          payload: {
            headers: [
              { name: 'From', value: 'original@example.com' },
              { name: 'Subject', value: 'Original Subject' },
              { name: 'Message-ID', value: '<original-message-id>' },
            ],
          },
        },
      };

      mockGmailClient.users.messages.get.mockResolvedValue(mockOriginalMessage);
      mockGmailClient.users.drafts.create.mockResolvedValue({
        data: { id: 'draft1', message: { id: 'draft-msg1', threadId: 'thread1' } },
      });

      await gmailService.createDraftReply('msg1', 'Reply text');

      const createCall = mockGmailClient.users.drafts.create.mock.calls[0][0];
      // Decode base64url: convert back to base64 format
      const base64url = createCall.requestBody.message.raw;
      const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      const padding = base64.length % 4;
      const paddedBase64 = base64 + (padding ? '='.repeat(4 - padding) : '');
      const rawMessage = Buffer.from(paddedBase64, 'base64').toString();
      
      // Subject should be "Re: Original Subject" (since original doesn't start with Re:)
      expect(rawMessage).toMatch(/Subject: Re: Original Subject/);
    });
  });
});

