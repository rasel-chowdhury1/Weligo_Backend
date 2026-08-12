import { sendEmail } from "./mailSender";



interface OtpSendEmailParams {
  sentTo: string;
  subject: string;
  name: string;
  otp: string | number;
  expiredAt: string;
}

const otpSendEmail = async ({
  sentTo,
  subject,
  name,
  otp,
  expiredAt,
}: OtpSendEmailParams): Promise<void> => {
  await sendEmail(
    sentTo,
    subject,
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
       <h1>Hello dear, ${name}</h1>
      <h2 style="color: #4CAF50;">Your One Time OTP</h2>
      <div style="background-color: #f2f2f2; padding: 20px; border-radius: 5px;">
        <p style="font-size: 16px;">Your OTP is: <strong>${otp}</strong></p>
        <p style="font-size: 14px; color: #666;">This OTP is valid until: ${expiredAt.toLocaleString()}</p>
      </div>
    </div>`,
  );
};

interface NewUserJoinedEmailParams {
  fullName: string;
  email: string;
  role: string;
}

const newUserJoinedEmail = async ({ fullName, email, role }: NewUserJoinedEmailParams): Promise<void> => {
  const roleColor = role === 'provider' ? '#059669' : '#4F46E5';
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;background:#f4f4f7;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#5B21B6 0%,#4F46E5 100%);border-radius:12px 12px 0 0;padding:30px 40px;">
            <span style="display:inline-block;width:40px;height:40px;background:#fff;border-radius:9px;text-align:center;line-height:40px;font-size:20px;font-weight:900;color:#5B21B6;vertical-align:middle;">W</span>
            <span style="font-size:26px;font-weight:700;color:#fff;margin-left:10px;vertical-align:middle;letter-spacing:0.5px;">Weligo</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#fff;padding:40px 48px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
            <h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111827;">New User Joined! &#x1F389;</h2>
            <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
              A new user has registered on the Weligo platform. Here are the details:
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:28px;">
              <tr>
                <td style="padding:14px 20px;font-size:13px;font-weight:600;color:#374151;background:#f9fafb;width:38%;border-bottom:1px solid #e5e7eb;">Full Name</td>
                <td style="padding:14px 20px;font-size:14px;color:#111827;border-bottom:1px solid #e5e7eb;">${fullName}</td>
              </tr>
              <tr>
                <td style="padding:14px 20px;font-size:13px;font-weight:600;color:#374151;background:#f9fafb;border-bottom:1px solid #e5e7eb;">Email</td>
                <td style="padding:14px 20px;font-size:14px;color:#111827;border-bottom:1px solid #e5e7eb;">${email}</td>
              </tr>
              <tr>
                <td style="padding:14px 20px;font-size:13px;font-weight:600;color:#374151;background:#f9fafb;">Role</td>
                <td style="padding:14px 20px;">
                  <span style="display:inline-block;background:${roleColor};color:#fff;font-size:12px;font-weight:600;padding:4px 14px;border-radius:20px;">${roleLabel}</span>
                </td>
              </tr>
            </table>

            <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px;padding:14px 18px;">
              <p style="margin:0;font-size:13px;color:#166534;">&#x1F550;&nbsp; Registered on: <strong>${new Date().toUTCString()}</strong></p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:22px 40px;">
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">&#169; ${new Date().getFullYear()} Weligo. All rights reserved.</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">This is an automated notification. Please do not reply.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail('info@weligo.ch', '🎉 New User Joined Weligo', html);
  // await sendEmail('raseldev847@gmail.com', '🎉 New User Joined Weligo', html);
};

export { otpSendEmail, newUserJoinedEmail };
