const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationEmail(email, username, verificationUrl) {
  try {
    await resend.emails.send({
      from: 'Nexis <onboarding@resend.dev>',
      to: email,
      subject: 'Verify your Nexis account',
      html: `
        <div style="background:#000;color:#fff;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;">
          <h1 style="color:#fff;font-size:28px;margin-bottom:8px;">Welcome to Nexis, ${username}</h1>
          <p style="color:#999;margin-bottom:32px;">Click the button below to verify your email address.</p>
          <a href="${verificationUrl}" style="background:#fff;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Verify Email</a>
          <p style="color:#666;margin-top:32px;font-size:12px;">This link expires in 24 hours. If you didn't create a Nexis account, ignore this email.</p>
        </div>
      `
    });
    console.log(`Verification email sent successfully to ${email}`);
  } catch (error) {
    console.error(`Error sending verification email to ${email}:`, error);
    throw error;
  }
}

module.exports = { sendVerificationEmail };
