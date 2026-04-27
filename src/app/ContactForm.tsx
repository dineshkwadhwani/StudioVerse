"use client";

import styles from "./StudioVersePage.module.css";

export default function ContactForm() {
  return (
    <form className={styles.contactForm} onSubmit={(e) => e.preventDefault()}>
      <div className={styles.contactRow}>
        <div className={styles.contactField}>
          <label className={styles.contactLabel} htmlFor="contact-name">Full Name</label>
          <input id="contact-name" className={styles.contactInput} type="text" placeholder="Jane Smith" />
        </div>
        <div className={styles.contactField}>
          <label className={styles.contactLabel} htmlFor="contact-email">Email Address</label>
          <input id="contact-email" className={styles.contactInput} type="email" placeholder="jane@company.com" />
        </div>
      </div>
      <div className={styles.contactField}>
        <label className={styles.contactLabel} htmlFor="contact-studio">Studio of Interest</label>
        <input id="contact-studio" className={styles.contactInput} type="text" placeholder="e.g. Coaching Studio, HR Studio…" />
      </div>
      <div className={styles.contactField}>
        <label className={styles.contactLabel} htmlFor="contact-message">Message</label>
        <textarea id="contact-message" className={styles.contactTextarea} placeholder="Tell us about your organisation and what you're looking for…" />
      </div>
      <button type="submit" className={styles.contactSubmit}>Send Message →</button>
    </form>
  );
}
