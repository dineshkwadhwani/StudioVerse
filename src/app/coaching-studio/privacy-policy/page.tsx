import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Coaching Studio",
  description: "Privacy Policy for Coaching Studio by coachingstudio.in.",
};

const effectiveDate = "1 April 2026";
const lastUpdatedDate = "2 April 2026";

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

export default function CoachingStudioPrivacyPolicyPage() {
  return (
    <main style={pageStyle}>
      <h1 style={{ marginBottom: 8 }}>Privacy Policy for Coaching Studio</h1>
      <p>
        Effective date: <strong>{effectiveDate}</strong>
        <br />
        Last updated: <strong>{lastUpdatedDate}</strong>
      </p>

      <h2 style={pointTitleStyle}><strong>1. Who We Are</strong></h2>
      <p>
        Coaching Studio is operated by <strong>coachingstudio.in</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
      </p>
      <p>
        Website: coachingstudio.in
        <br />
        Business address: A 1002, Sai Ambience, Pimple Saudagar, Pune, India 411027
        <br />
        Support email: <a href="mailto:contact@coachingstudio.in">contact@coachingstudio.in</a>
        <br />
        Privacy contact email: <a href="mailto:contact@coachingstudio.in">contact@coachingstudio.in</a>
      </p>

      <h2 style={pointTitleStyle}><strong>2. Scope of This Policy</strong></h2>
      <p>
        This Privacy Policy applies to personal data processed in connection with Coaching Studio,
        including the website, user accounts, coaching workflows, and related support operations.
      </p>

      <h2 style={pointTitleStyle}><strong>3. Role of the Platform in a Multi-Tenant Environment</strong></h2>
      <p>
        Coaching Studio is a multi-tenant platform used by companies, professionals (including coaches),
        and individual participants. In some cases, coachingstudio.in acts as the service
        provider and controller for platform operations (for example, account administration, security,
        platform analytics, and service communications). In other cases, a tenant organization or coach may
        act as controller for participant data they enter, assign, review, or export within their tenant setup.
      </p>

      <h2 style={pointTitleStyle}><strong>4. Categories of Personal Data We Collect</strong></h2>
      <p>Depending on your use of Coaching Studio, we may collect:</p>
      <ul>
        <li>Identity and profile data: name, username, role, organization, and account identifiers.</li>
        <li>Contact data: email address, phone number, and communication preferences.</li>
        <li>Professional data: company, team, role, and coach or participant associations.</li>
        <li>Account and authentication data: login details, access events, and security metadata.</li>
        <li>Billing and transaction data: billing contact data, invoices, and payment-related records.</li>
        <li>Support and communication data: messages, tickets, and feedback submissions.</li>
        <li>
          Assessment and coaching data: survey responses, reflections, progress records, plans,
          assignments, and reports created through the service.
        </li>
        <li>Usage data: feature interactions, session timestamps, and diagnostic logs.</li>
        <li>Technical and device data: IP address, browser type, operating system, and identifiers.</li>
        <li>
          Content and upload data: files, notes, and other materials submitted to the platform.
        </li>
      </ul>

      <h2 style={pointTitleStyle}><strong>5. Where the Data Comes From</strong></h2>
      <p>We may obtain personal data from:</p>
      <ul>
        <li>Users directly when they register, submit forms, or interact with features.</li>
        <li>Tenant companies or administrators who provision users and assign programs.</li>
        <li>Coaches or professional users who input or review coaching-related data.</li>
        <li>Integrations and third-party tools connected by tenants or users.</li>
        <li>Service providers who support identity, billing, communication, and analytics operations.</li>
      </ul>

      <h2 style={pointTitleStyle}><strong>6. Why We Use Personal Data</strong></h2>
      <p>We use personal data for the following purposes:</p>
      <ul>
        <li>Account creation, identity verification, and access management.</li>
        <li>Delivery of coaching services, assessments, programs, and reports.</li>
        <li>Customer support and service communications.</li>
        <li>Billing, invoicing, and transaction administration.</li>
        <li>Security monitoring, fraud prevention, and abuse detection.</li>
        <li>Product analytics, reliability improvements, and feature development.</li>
        <li>Legal, regulatory, contractual, and audit compliance.</li>
      </ul>

      <h2 style={pointTitleStyle}><strong>7. Legal Basis and Regulatory Justification</strong></h2>
      <p>
        Where required by law, we process personal data under one or more legal bases, including consent,
        contract performance, legitimate interests, and compliance with legal obligations. We design privacy
        practices to align with applicable frameworks, including GDPR/UK GDPR, CCPA/CPRA, LGPD,
        PIPEDA, India&apos;s Digital Personal Data Protection Act, 2023 (DPDP Act), and COPPA requirements
        where relevant.
      </p>

      <h2 style={pointTitleStyle}><strong>8. Sharing and Disclosures</strong></h2>
      <p>We may share personal data with:</p>
      <ul>
        <li>Hosting and infrastructure providers used to run and secure the platform.</li>
        <li>Payment processors and billing service providers.</li>
        <li>Analytics and product monitoring providers.</li>
        <li>Email, notification, and support communication providers.</li>
        <li>Professional users within a tenant setup (for example coaches and company administrators).</li>
        <li>Professional advisers, auditors, and legal or regulatory authorities when required.</li>
        <li>
          Business transaction counterparties in connection with a merger, acquisition, or reorganization,
          subject to confidentiality and legal protections.
        </li>
      </ul>
      <p>
        We do not sell personal data for monetary consideration. If data &quot;sale&quot; or &quot;sharing&quot; is interpreted
        broadly under applicable law, users may exercise relevant opt-out rights where available.
      </p>

      <h2 style={pointTitleStyle}><strong>9. Subprocessor Categories</strong></h2>
      <p>Subprocessor categories used by Coaching Studio may include:</p>
      <ul>
        <li>Cloud hosting and database infrastructure providers (for example Firebase/Google Cloud).</li>
        <li>Application hosting and deployment providers (for example Vercel when used).</li>
        <li>Email delivery and messaging providers.</li>
        <li>Payment processing and billing providers.</li>
        <li>Analytics and product measurement providers.</li>
        <li>AI service providers, where AI-enabled features are made available.</li>
      </ul>

      <h2 style={pointTitleStyle}><strong>10. Cookies and Tracking Technologies</strong></h2>
      <p>
        We may use cookies and similar technologies for authentication, security, analytics, and service
        functionality. Browser settings can be used to manage cookie preferences, though some features may
        be affected. Where required, a separate cookie notice or consent mechanism may be provided.
      </p>

      <h2 style={pointTitleStyle}><strong>11. International Data Transfers</strong></h2>
      <p>
        Coaching Studio uses multi-region cloud infrastructure (including Firebase/Google Cloud services).
        Your data may be processed in countries other than your own. Where required, we use appropriate
        safeguards for cross-border transfers.
      </p>

      <h2 style={pointTitleStyle}><strong>12. Data Retention and Deletion</strong></h2>
      <p>
        We retain personal data only for as long as needed for the purposes described in this policy,
        including service delivery, legal compliance, dispute resolution, and enforcement of agreements.
        Retention periods vary by data category, tenant contracts, and legal obligations.
      </p>
      <p>
        If a user leaves a program, tenant visibility and access to their data may change based on tenant
        settings and contractual terms. If deletion is requested, we will evaluate and process the request under
        applicable law, subject to legitimate retention requirements such as audit, legal, tax, security, and
        dispute-handling obligations. Aggregated or de-identified data may be retained.
      </p>

      <h2 style={pointTitleStyle}><strong>13. Assessment and Coaching Data Visibility</strong></h2>
      <p>
        Assessment responses, reflections, reports, and coaching progress may be visible to different parties
        depending on tenant configuration and role permissions. These parties can include the individual user,
        assigned coach, company administrator, and authorized platform support personnel as needed for
        service delivery, security, or compliance.
      </p>

      <h2 style={pointTitleStyle}><strong>14. Security Measures</strong></h2>
      <p>
        We apply technical and organizational security measures designed to protect personal data against
        unauthorized access, disclosure, alteration, and destruction. These measures include access controls,
        authentication safeguards, logging, and infrastructure protections. No system can be guaranteed as
        fully secure, but we continuously improve our controls and monitoring.
      </p>

      <h2 style={pointTitleStyle}><strong>15. Children&apos;s Privacy</strong></h2>
      <p>
        Coaching Studio is not intended for children under 13. Users aged 13 and above may use the
        service subject to applicable law and platform terms. We do not knowingly collect personal data
        from children under 13. If you believe such data has been provided, contact us so we can review and
        delete it where appropriate.
      </p>

      <h2 style={pointTitleStyle}><strong>16. Privacy Rights by Region</strong></h2>
      <p>Depending on applicable law and your location, you may have rights to:</p>
      <ul>
        <li>Request access to your personal data.</li>
        <li>Request correction of inaccurate data.</li>
        <li>Request deletion of personal data, subject to legal exceptions.</li>
        <li>Object to or restrict certain processing activities where applicable.</li>
        <li>Request portability of your data where available.</li>
        <li>Withdraw consent where processing is based on consent.</li>
        <li>Opt out of certain data sharing, sale, or targeted advertising where applicable.</li>
        <li>Lodge a complaint with a competent supervisory or regulatory authority.</li>
      </ul>

      <h2 style={pointTitleStyle}><strong>17. Contact Details and Complaints</strong></h2>
      <p>
        For privacy requests, complaints, or questions, contact us at:
        <br />
        Support email: <a href="mailto:contact@coachingstudio.in">contact@coachingstudio.in</a>
        <br />
        Privacy contact email: <a href="mailto:contact@coachingstudio.in">contact@coachingstudio.in</a>
      </p>

      <h2 style={pointTitleStyle}><strong>18. Policy Updates</strong></h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be posted with a revised
        last updated date. Continued use of Coaching Studio after updates indicates acknowledgment of the
        revised policy, to the extent permitted by law.
      </p>
    </main>
  );
}