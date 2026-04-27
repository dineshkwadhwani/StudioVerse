import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Coaching Studio",
  description: "Terms of Service for Coaching Studio by coachingstudio.in.",
};

const effectiveDate = "1 April 2026";
const lastUpdatedDate = "27 April 2026";

const pageStyle = {
  maxWidth: 920,
  margin: "0 auto",
  padding: "40px 20px 56px",
  lineHeight: 1.7,
  fontFamily: "Georgia, Times New Roman, serif",
  color: "#1f2937",
};

const pointTitleStyle = {
  fontWeight: 700,
  marginTop: 30,
  marginBottom: 10,
  fontSize: "1.2rem",
};

export default function CoachingStudioTermsOfServicePage() {
  return (
    <main style={pageStyle}>
      <h1 style={{ marginBottom: 8 }}>Terms of Service for Coaching Studio</h1>
      <p>
        Effective date: <strong>{effectiveDate}</strong>
        <br />
        Last updated: <strong>{lastUpdatedDate}</strong>
      </p>

      <p>
        Please read these Terms of Service (&quot;Terms&quot;) carefully before using Coaching Studio
        (&quot;Service&quot;) operated by <strong>coachingstudio.in</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
        By accessing or using the Service, you agree to be bound by these Terms. If you do not
        agree, do not use the Service.
      </p>

      <h2 style={pointTitleStyle}><strong>1. About Coaching Studio</strong></h2>
      <p>
        Coaching Studio is a professional platform for coaches, coaching companies, and their clients.
        It provides tools to run assessments, design and deliver programs, manage events, assign
        activities, and track individual progress — all within a structured, role-based environment.
        The platform is operated by coachingstudio.in.
      </p>
      <p>
        Website: coachingstudio.in
        <br />
        Business address: A 1002, Sai Ambience, Pimple Saudagar, Pune, India 411027
        <br />
        Support email: <a href="mailto:contact@coachingstudio.in">contact@coachingstudio.in</a>
      </p>

      <h2 style={pointTitleStyle}><strong>2. Eligibility</strong></h2>
      <p>
        You must be at least 13 years of age to use the Service. By using Coaching Studio, you
        represent and warrant that you meet this age requirement and that you have the legal
        capacity to enter into these Terms. If you are using the Service on behalf of an organization,
        you represent that you are authorized to bind that organization to these Terms.
      </p>

      <h2 style={pointTitleStyle}><strong>3. Account Registration</strong></h2>
      <p>
        To access most features of the Service, you must register for an account. You agree to:
      </p>
      <ul>
        <li>Provide accurate, current, and complete registration information.</li>
        <li>Maintain and promptly update your information to keep it accurate.</li>
        <li>Keep your login credentials confidential and not share them with others.</li>
        <li>Notify us immediately of any unauthorized access to your account.</li>
      </ul>
      <p>
        We reserve the right to suspend or terminate accounts that contain inaccurate information
        or that are used in breach of these Terms.
      </p>

      <h2 style={pointTitleStyle}><strong>4. User Roles and Permissions</strong></h2>
      <p>
        Coaching Studio operates a role-based access model. Your role — Company, Coach (Professional),
        or Individual — determines what features you can access and what content you can create, manage,
        or view. Roles are assigned at registration or by a company administrator within your tenant.
        You agree to use only those features and data that your assigned role permits.
      </p>

      <h2 style={pointTitleStyle}><strong>5. Acceptable Use</strong></h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful, fraudulent, or harmful purpose.</li>
        <li>Upload or transmit content that is defamatory, abusive, obscene, or infringes third-party rights.</li>
        <li>Attempt to gain unauthorized access to other accounts, systems, or networks.</li>
        <li>Interfere with or disrupt the integrity or performance of the Service.</li>
        <li>Use automated tools to scrape, crawl, or extract data from the Service without permission.</li>
        <li>Impersonate any person or entity or misrepresent your affiliation.</li>
        <li>Reverse engineer, decompile, or attempt to extract source code from the platform.</li>
        <li>Use the Service to send unsolicited communications or spam.</li>
      </ul>

      <h2 style={pointTitleStyle}><strong>6. Content You Submit</strong></h2>
      <p>
        You retain ownership of any content you submit to Coaching Studio, including assessment responses,
        program materials, notes, and uploads (&quot;User Content&quot;). By submitting User Content, you
        grant coachingstudio.in a limited, non-exclusive licence to store, process, and display that
        content solely to operate and improve the Service.
      </p>
      <p>
        You are solely responsible for the accuracy, legality, and appropriateness of User Content you
        submit. We reserve the right to remove content that violates these Terms or applicable law.
      </p>

      <h2 style={pointTitleStyle}><strong>7. Coaching Data and Confidentiality</strong></h2>
      <p>
        Coaching relationships involve sensitive personal and professional information. Coaches and
        coaching companies using the platform are responsible for maintaining the confidentiality of
        their clients&apos; data in accordance with applicable professional standards and laws.
        coachingstudio.in processes this data as described in our{" "}
        <a href="/coaching-studio/privacy-policy">Privacy Policy</a> and does not disclose coaching
        session content to unauthorized parties.
      </p>

      <h2 style={pointTitleStyle}><strong>8. Intellectual Property</strong></h2>
      <p>
        All platform software, design, trademarks, logos, and content provided by coachingstudio.in
        remain the exclusive property of coachingstudio.in and its licensors. Nothing in these Terms
        transfers any intellectual property rights to you beyond the limited right to use the Service
        as described herein.
      </p>

      <h2 style={pointTitleStyle}><strong>9. Credits, Wallets, and Payments</strong></h2>
      <p>
        Coaching Studio may use a credit or wallet system to access certain programs, assessments, or
        events. Credits are non-transferable and have no cash value unless explicitly stated. We reserve
        the right to modify credit values, pricing, and availability with reasonable notice. Payments
        are processed through third-party payment providers and are subject to their terms and applicable
        refund policies.
      </p>

      <h2 style={pointTitleStyle}><strong>10. Service Availability and Changes</strong></h2>
      <p>
        We aim to provide reliable access to the Service but do not guarantee uninterrupted availability.
        The Service may be temporarily unavailable due to maintenance, updates, or circumstances beyond our
        control. We reserve the right to modify, suspend, or discontinue features of the Service at any
        time, with reasonable notice where possible.
      </p>

      <h2 style={pointTitleStyle}><strong>11. Third-Party Services and Integrations</strong></h2>
      <p>
        The Service may integrate with or link to third-party tools and services. These third parties
        operate under their own terms and privacy policies. coachingstudio.in is not responsible for
        the practices, content, or availability of third-party services. Your use of such services is
        at your own risk.
      </p>

      <h2 style={pointTitleStyle}><strong>12. Disclaimer of Warranties</strong></h2>
      <p>
        The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without any warranties,
        express or implied, including but not limited to warranties of merchantability, fitness for a
        particular purpose, accuracy, or non-infringement. coachingstudio.in does not warrant that the
        Service will be error-free, secure, or continuously available.
      </p>

      <h2 style={pointTitleStyle}><strong>13. Limitation of Liability</strong></h2>
      <p>
        To the maximum extent permitted by applicable law, coachingstudio.in shall not be liable for
        any indirect, incidental, special, consequential, or punitive damages, including loss of data,
        revenue, profits, or goodwill, arising from your use of or inability to use the Service.
        Our total aggregate liability for any claim arising under these Terms shall not exceed the
        amount you paid to us in the twelve months preceding the claim.
      </p>

      <h2 style={pointTitleStyle}><strong>14. Indemnification</strong></h2>
      <p>
        You agree to indemnify and hold harmless coachingstudio.in, its affiliates, and their
        respective officers, directors, employees, and agents from any claims, damages, losses, and
        costs (including reasonable legal fees) arising from your use of the Service, your violation
        of these Terms, or your infringement of any third-party rights.
      </p>

      <h2 style={pointTitleStyle}><strong>15. Cancellation Policy</strong></h2>
      <p>
        You may cancel your participation in a program or event subject to the following conditions:
      </p>
      <ul>
        <li>
          <strong>Programs:</strong> Cancellations requested more than 7 days before the program start
          date are eligible for a full credit refund. Cancellations within 7 days of the start date are
          not eligible for a refund unless the program is cancelled by coachingstudio.in or the
          facilitating coach.
        </li>
        <li>
          <strong>Events:</strong> Cancellations requested more than 48 hours before the event date are
          eligible for a full credit refund. Cancellations within 48 hours of the event are not eligible
          for a refund, except where the event is cancelled or rescheduled by the organiser.
        </li>
        <li>
          <strong>Assessments:</strong> Once an assessment has been started or accessed, it is considered
          consumed and is not eligible for cancellation or refund.
        </li>
        <li>
          <strong>Subscriptions and plans:</strong> Where applicable, you may cancel a subscription at
          any time. Cancellation takes effect at the end of the current billing period. No pro-rated
          refunds are issued for partial periods unless required by applicable law.
        </li>
      </ul>
      <p>
        To request a cancellation, contact us at{" "}
        <a href="mailto:contact@coachingstudio.in">contact@coachingstudio.in</a> with your account
        details and the item you wish to cancel.
      </p>

      <h2 style={pointTitleStyle}><strong>16. Refund Policy</strong></h2>
      <p>
        Refunds on Coaching Studio are governed by the following terms:
      </p>
      <ul>
        <li>
          <strong>Credits and coins:</strong> Credits or coins purchased on the platform are
          non-refundable once added to your wallet, except where a technical error resulted in an
          incorrect charge or duplicate transaction. In such cases, contact us within 7 days of the
          transaction.
        </li>
        <li>
          <strong>Eligible cancellations:</strong> Where a cancellation qualifies for a refund under
          Section 15, the refund will be issued as platform credits unless you specifically request a
          monetary refund to your original payment method. Monetary refunds are processed within 7–10
          business days.
        </li>
        <li>
          <strong>Platform-initiated cancellations:</strong> If coachingstudio.in cancels or
          discontinues a program, event, or service you have paid for, you will receive a full refund
          to your original payment method within 10 business days.
        </li>
        <li>
          <strong>Partially consumed programs:</strong> If you have accessed or completed a portion of
          a program, any refund (where applicable) will be pro-rated based on the proportion of content
          not yet accessed, at our reasonable discretion.
        </li>
        <li>
          <strong>Non-refundable items:</strong> Completed assessments, consumed credits, and
          personalised or on-demand coaching sessions that have already been delivered are not
          eligible for refund.
        </li>
      </ul>
      <p>
        All refund requests must be submitted to{" "}
        <a href="mailto:contact@coachingstudio.in">contact@coachingstudio.in</a> with your
        transaction reference. We reserve the right to decline refund requests that do not meet the
        above criteria.
      </p>

      <h2 style={pointTitleStyle}><strong>17. Account Termination</strong></h2>
      <p>
        You may close your account at any time by contacting us at{" "}
        <a href="mailto:contact@coachingstudio.in">contact@coachingstudio.in</a>.
        We may suspend or terminate your account if you violate these Terms, engage in fraudulent
        activity, or for any other reason at our discretion with reasonable notice. Upon termination,
        your right to use the Service ceases immediately. Data retention following termination is
        governed by our Privacy Policy.
      </p>

      <h2 style={pointTitleStyle}><strong>18. Governing Law and Disputes</strong></h2>
      <p>
        These Terms are governed by the laws of India. Any disputes arising under these Terms shall
        be subject to the exclusive jurisdiction of the courts located in Pune, Maharashtra, India.
        We encourage you to contact us first to attempt to resolve any dispute informally before
        initiating formal proceedings.
      </p>

      <h2 style={pointTitleStyle}><strong>19. Changes to These Terms</strong></h2>
      <p>
        We may update these Terms from time to time. We will notify you of material changes by posting
        the revised Terms with an updated effective date. Continued use of the Service after changes
        are posted constitutes your acceptance of the revised Terms.
      </p>

      <h2 style={pointTitleStyle}><strong>20. Contact Us</strong></h2>
      <p>
        For any questions about these Terms, contact us at:
        <br />
        Email: <a href="mailto:contact@coachingstudio.in">contact@coachingstudio.in</a>
        <br />
        Address: A 1002, Sai Ambience, Pimple Saudagar, Pune, India 411027
      </p>
    </main>
  );
}
