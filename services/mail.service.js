import nodemailer from 'nodemailer';

const smtpPort = Number(process.env.SMTP_PORT || 587);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function verifyMailConfiguration() {
  await transporter.verify();
}

export async function sendEmail({ to, subject, text, html }) {
  return transporter.sendMail({
    from: {
      name: process.env.MAIL_FROM_NAME || 'Nord Stratégie',
      address: process.env.MAIL_FROM_ADDRESS,
    },
    to,
    subject,
    text,
    html,
  });
}