import nodemailer from "nodemailer";

type OtpPurpose = "registration" | "withdrawal" | "password_reset";

function parseSecure(port: number) {
  return port === 465;
}

/** Vercel-style names (EMAIL_SERVER_*) plus legacy SMTP_* — same as NextAuth / common hosts. */
function smtpHost() {
  return process.env.EMAIL_SERVER_HOST || process.env.SMTP_HOST;
}

function smtpPort() {
  return Number(process.env.EMAIL_SERVER_PORT || process.env.SMTP_PORT || 587);
}

function smtpUser() {
  return (
    process.env.EMAIL_SERVER_USER ||
    process.env.SMTP_USER ||
    process.env.EMAIL_FROM ||
    ""
  ).trim();
}

function smtpPass() {
  return process.env.EMAIL_SERVER_PASSWORD || process.env.SMTP_PASS || "";
}

function mailFrom() {
  return (
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    smtpUser()
  ).trim();
}

export function isEmailConfigured() {
  if (process.env.SMTP_URL) {
    return true;
  }
  const host = smtpHost();
  const pass = smtpPass();
  const user = smtpUser();
  const from = mailFrom();
  return Boolean(host && smtpPort() && pass && user && from);
}

function getTransporter() {
  if (process.env.SMTP_URL) {
    return nodemailer.createTransport(process.env.SMTP_URL);
  }

  const host = smtpHost();
  const port = smtpPort();
  const user = smtpUser();
  const pass = smtpPass();

  if (!host || !user || !pass) {
    throw new Error("Email service is not configured");
  }

  return nodemailer.createTransport({
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : parseSecure(port),
    auth: {
      user,
      pass,
    },
  });
}

function getPurposeLabel(purpose: OtpPurpose) {
  if (purpose === "registration") return "account registration";
  if (purpose === "password_reset") return "password reset";
  return "verification";
}

export async function sendOtpEmail({
  to,
  otp,
  purpose,
}: {
  to: string;
  otp: string;
  purpose: OtpPurpose;
}) {
  const from = mailFrom();

  if (!from) {
    throw new Error("Email sender is not configured");
  }

  const transporter = getTransporter();
  const purposeLabel = getPurposeLabel(purpose);

  await transporter.sendMail({
    from,
    to,
    subject: `Your OTP code for ${purposeLabel}`,
    text: `Your OTP code is ${otp}. This code will expire in 10 minutes.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 16px">OTP Verification</h2>
      <p style="margin:0 0 12px">Use the code below to complete your ${purposeLabel}.</p>
      <div style="display:inline-block;padding:12px 20px;border-radius:12px;background:#111827;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:4px">
        ${otp}
      </div>
      <p style="margin:16px 0 0">This code will expire in 10 minutes.</p>
    </div>`,
  });
}
