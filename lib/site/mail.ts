type Mail = {
  to: string;

  subject: string;

  text: string;
};

export function mailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY
    && process.env.SPONSOR_FROM_EMAIL,
  );
}

export async function sendMail(mail: Mail) {
  const key = process.env.RESEND_API_KEY;

  const from = process.env.SPONSOR_FROM_EMAIL;

  if (!key || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email is not configured.");
    }

    console.info(`[mail] to ${mail.to}: ${mail.subject}\n${mail.text}`);

    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
    }),
  });

  if (!response.ok) {
    throw new Error("Email did not send.");
  }
}

export function wiseDetails() {
  return process.env.WISE_PAYMENT_DETAILS?.replace(/\\n/g, "\n").trim()
    || "Payment details will follow in a separate email.";
}

export function ownerEmail() {
  return process.env.SPONSOR_OWNER_EMAIL ?? null;
}
