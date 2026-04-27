"use client";

import { useState } from "react";
import styles from "./StudioVersePage.module.css";

const FROM_EMAIL = "noreply@send.coachingstudio.in";
const FROM_NAME = "StudioVerse";
const TO_EMAIL = "contact@coachingstudio.in";

type FormState = {
  name: string;
  email: string;
  studio: string;
  message: string;
};

type Status = "idle" | "sending" | "success" | "error";

export default function ContactForm() {
  const [form, setForm] = useState<FormState>({ name: "", email: "", studio: "", message: "" });
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const studio = form.studio.trim();
    const message = form.message.trim();

    if (!name || !email || !message) {
      setErrorMsg("Please fill in your name, email, and message.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setStatus("sending");
    setErrorMsg("");

    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      studio ? `Studio of Interest: ${studio}` : null,
      ``,
      message,
    ].filter(Boolean).join("\n");

    try {
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: TO_EMAIL,
          toName: "StudioVerse",
          fromEmail: FROM_EMAIL,
          fromName: `${name} via StudioVerse`,
          subject: `StudioVerse Contact: ${name}${studio ? ` — ${studio}` : ""}`,
          body,
        }),
      });

      const data = await res.json() as { ok?: boolean; error?: string; detail?: string };

      if (!res.ok || !data.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setStatus("success");
      setForm({ name: "", email: "", studio: "", message: "" });
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please check your connection and try again.");
    }
  }

  if (status === "success") {
    return (
      <div className={styles.contactSuccess}>
        <p className={styles.contactSuccessTitle}>Message sent!</p>
        <p className={styles.contactSuccessBody}>
          Thanks for reaching out. We&apos;ll get back to you at <strong>{form.email || "your email"}</strong> shortly.
        </p>
        <button type="button" className={styles.contactSubmit} onClick={() => setStatus("idle")}>
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <form className={styles.contactForm} onSubmit={handleSubmit} noValidate>
      <div className={styles.contactRow}>
        <div className={styles.contactField}>
          <label className={styles.contactLabel} htmlFor="contact-name">Full Name</label>
          <input
            id="contact-name"
            name="name"
            className={styles.contactInput}
            type="text"
            placeholder="Jane Smith"
            value={form.name}
            onChange={handleChange}
            disabled={status === "sending"}
          />
        </div>
        <div className={styles.contactField}>
          <label className={styles.contactLabel} htmlFor="contact-email">Email Address</label>
          <input
            id="contact-email"
            name="email"
            className={styles.contactInput}
            type="email"
            placeholder="jane@company.com"
            value={form.email}
            onChange={handleChange}
            disabled={status === "sending"}
          />
        </div>
      </div>
      <div className={styles.contactField}>
        <label className={styles.contactLabel} htmlFor="contact-studio">Studio of Interest</label>
        <input
          id="contact-studio"
          name="studio"
          className={styles.contactInput}
          type="text"
          placeholder="e.g. Coaching Studio, HR Studio…"
          value={form.studio}
          onChange={handleChange}
          disabled={status === "sending"}
        />
      </div>
      <div className={styles.contactField}>
        <label className={styles.contactLabel} htmlFor="contact-message">Message</label>
        <textarea
          id="contact-message"
          name="message"
          className={styles.contactTextarea}
          placeholder="Tell us about your organisation and what you're looking for…"
          value={form.message}
          onChange={handleChange}
          disabled={status === "sending"}
        />
      </div>
      {errorMsg && <p className={styles.contactError}>{errorMsg}</p>}
      <button type="submit" className={styles.contactSubmit} disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send Message →"}
      </button>
    </form>
  );
}
