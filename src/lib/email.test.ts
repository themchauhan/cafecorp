import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { sendMail, createTransport } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: { createTransport },
}));

createTransport.mockReturnValue({ sendMail });

import { sendInviteEmail } from './email';

describe('sendInviteEmail', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('reports not sent when Gmail credentials are not configured', async () => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;

    const result = await sendInviteEmail({
      to: 'staff@demo.cafe',
      name: 'New Staff',
      resetLink: 'https://example.com/reset',
    });

    expect(result).toEqual({ sent: false });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends via Gmail SMTP and reports sent when credentials are configured', async () => {
    process.env.GMAIL_USER = 'cafecorp@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'app-password';
    sendMail.mockResolvedValue({});

    const result = await sendInviteEmail({
      to: 'staff@demo.cafe',
      name: 'New Staff',
      resetLink: 'https://example.com/reset',
    });

    expect(result).toEqual({ sent: true });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'cafecorp@gmail.com',
        to: 'staff@demo.cafe',
      }),
    );
  });

  it('reports not sent (never throws) when the SMTP send fails', async () => {
    process.env.GMAIL_USER = 'cafecorp@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'app-password';
    sendMail.mockRejectedValue(new Error('SMTP connection refused'));

    const result = await sendInviteEmail({
      to: 'staff@demo.cafe',
      name: 'New Staff',
      resetLink: 'https://example.com/reset',
    });

    expect(result).toEqual({ sent: false });
  });
});
