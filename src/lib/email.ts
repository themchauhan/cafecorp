import 'server-only';
import nodemailer from 'nodemailer';

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  transporter ??= nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return transporter;
}

export async function sendInviteEmail(input: {
  to: string;
  name: string;
  resetLink: string;
}): Promise<{ sent: boolean }> {
  const transport = getTransporter();
  if (!transport) return { sent: false };

  try {
    await transport.sendMail({
      from: process.env.GMAIL_USER,
      to: input.to,
      subject: "You've been invited to CafeCorp",
      text: `Hi ${input.name},\n\nYou've been invited to join CafeCorp. Set your password here:\n${input.resetLink}\n\nThis link is for one-time use.`,
      html: `<p>Hi ${input.name},</p><p>You've been invited to join CafeCorp. Set your password using the link below:</p><p><a href="${input.resetLink}">${input.resetLink}</a></p><p>This link is for one-time use.</p>`,
    });
    return { sent: true };
  } catch (error) {
    // Email delivery is a best-effort convenience, never a reason to
    // fail the whole invite — the admin always has the link as a
    // fallback to share manually (see inviteStaff).
    console.error('Failed to send invite email', error);
    return { sent: false };
  }
}
