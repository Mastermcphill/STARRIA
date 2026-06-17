// ---------------------------------------------------------------------------
// notification-core — email provider contract
// Implement for Resend, SendGrid, Nodemailer, etc.
// ---------------------------------------------------------------------------

export interface EmailRecipient {
  readonly to: string;
  readonly name?: string;
}

export interface EmailMessage {
  readonly from?: string;
  readonly to: EmailRecipient | EmailRecipient[];
  readonly subject: string;
  readonly htmlBody?: string;
  readonly textBody?: string;
  readonly replyTo?: string;
  readonly metadata?: Record<string, string>;
}

export interface EmailSendResult {
  readonly success: boolean;
  readonly messageId?: string;
  readonly errorMessage?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
