"use client";

import { useState } from "react";

const emptyForm = { name: "", email: "", institution: "", subject: "", message: "" };

export default function ContactUs() {
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Unable to send your message.");
      setForm(emptyForm);
      setStatus("Thank you. Your message has been sent to the CompassU team.");
    } catch (error) {
      setStatus(error.message || "Unable to send your message. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="contactSection" aria-labelledby="contact-heading">
      <div className="contactIntro">
        <div className="contactEyebrow">CONNECT WITH COMPASSU</div>
        <h2 id="contact-heading">Contact Us</h2>
        <p>Questions about CompassU, institutional partnerships, pilots, or support? Send us a message and our team will follow up.</p>
        <a className="contactEmail" href="mailto:jdasilva@getcompassu.com">jdasilva@getcompassu.com</a>
      </div>
      <form className="contactForm" onSubmit={submit}>
        <div className="contactTwo">
          <label>Name<input required maxLength={120} value={form.name} onChange={update("name")} autoComplete="name" /></label>
          <label>Email<input required type="email" maxLength={254} value={form.email} onChange={update("email")} autoComplete="email" /></label>
        </div>
        <label>Institution / Organization<input maxLength={180} value={form.institution} onChange={update("institution")} autoComplete="organization" /></label>
        <label>Subject<input required maxLength={180} value={form.subject} onChange={update("subject")} /></label>
        <label>Message<textarea required maxLength={5000} rows={6} value={form.message} onChange={update("message")} /></label>
        <button className="btn primary contactSubmit" type="submit" disabled={busy}>{busy ? "Sending…" : "Send Message"}</button>
        {status && <div className="contactStatus" role="status" aria-live="polite">{status}</div>}
      </form>
    </section>
  );
}
