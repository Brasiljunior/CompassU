const CONTACT_TO = "jdasilva@getcompassu.com";
const FROM = process.env.CONTACT_FROM_EMAIL || "CompassU Website <noreply@getcompassu.com>";

const clean = (value, max) => String(value || "").trim().slice(0, max);
const esc = (value) => clean(value, 5000).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

export async function POST(request) {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return Response.json({ error: "Contact email is temporarily unavailable." }, { status: 503 });

    const body = await request.json();
    const name = clean(body?.name, 120);
    const email = clean(body?.email, 254);
    const institution = clean(body?.institution, 180);
    const subject = clean(body?.subject, 180);
    const message = clean(body?.message, 5000);

    if (!name || !email || !subject || !message)
      return Response.json({ error: "Please complete all required fields." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return Response.json({ error: "Please enter a valid email address." }, { status: 400 });

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [CONTACT_TO],
        reply_to: email,
        subject: `CompassU Website: ${subject}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#172033">
          <h1 style="color:#0f1d40">New CompassU Contact Message</h1>
          <p><strong>Name:</strong> ${esc(name)}</p>
          <p><strong>Email:</strong> ${esc(email)}</p>
          <p><strong>Institution / Organization:</strong> ${esc(institution) || "Not provided"}</p>
          <p><strong>Subject:</strong> ${esc(subject)}</p>
          <hr style="border:0;border-top:1px solid #e7eaf0;margin:24px 0"/>
          <p style="white-space:pre-wrap">${esc(message)}</p>
        </div>`,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("CompassU contact delivery failed", data);
      return Response.json({ error: "Unable to send your message right now. Please try again." }, { status: 502 });
    }
    return Response.json({ sent: true });
  } catch (error) {
    console.error("CompassU contact error", error);
    return Response.json({ error: "Unable to send your message right now. Please try again." }, { status: 500 });
  }
}
