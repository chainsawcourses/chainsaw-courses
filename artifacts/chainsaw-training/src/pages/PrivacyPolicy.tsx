import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Printer } from "lucide-react";

export default function PrivacyPolicy() {
  useEffect(() => {
    document.title = "Privacy Policy — Chainsaw Courses";
    return () => { document.title = "Chainsaw Courses"; };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10 print:hidden">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/training" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-bold uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <span className="font-black tracking-tighter text-sm uppercase text-muted-foreground">Privacy Policy</span>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-bold uppercase tracking-widest"
          >
            <Printer className="w-4 h-4" />
            Print / PDF
          </button>
        </div>
      </header>

      {/* Policy content */}
      <main className="max-w-3xl mx-auto px-4 py-10 prose prose-sm prose-neutral max-w-none">
        <div className="text-center mb-8 print:mb-6">
          <img
            src={`${import.meta.env.BASE_URL}logo.png?v=20`}
            alt="Chainsaw Courses"
            className="h-12 w-auto mx-auto mb-3 print:h-10"
          />
          <h1 className="font-black tracking-tighter text-2xl uppercase text-foreground">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm mt-1">Chainsaw Courses &mdash; Vocational Safety Training Platform</p>
          <p className="text-muted-foreground text-xs mt-0.5">Last updated: July 2025 &nbsp;|&nbsp; Version 1.0</p>
        </div>

        <div className="space-y-7 text-sm leading-relaxed text-foreground font-mono">

          <section>
            <h2 className="font-black uppercase tracking-widest text-xs text-primary mb-2">1. Who We Are (Data Controller)</h2>
            <p>
              The data controller for this platform is <strong>Chainsaw Courses</strong>, the operator of the vocational chainsaw safety training service available at <a href="https://chainsawcourses.com" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">chainsawcourses.com</a>.
            </p>
            <p className="mt-2">
              Contact: <a href="mailto:info@chainsawcourses.com" className="text-primary hover:underline">info@chainsawcourses.com</a><br />
              Postal address: <span className="text-muted-foreground">[YOUR BUSINESS ADDRESS — update before publishing]</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              If you have questions about how your data is handled, or wish to exercise any of your rights under UK GDPR, please contact us using the details above.
            </p>
          </section>

          <section>
            <h2 className="font-black uppercase tracking-widest text-xs text-primary mb-2">2. What Data We Collect and Why</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-border">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border px-3 py-2 text-left font-bold uppercase tracking-widest">Data</th>
                    <th className="border border-border px-3 py-2 text-left font-bold uppercase tracking-widest">Purpose</th>
                    <th className="border border-border px-3 py-2 text-left font-bold uppercase tracking-widest">Lawful Basis</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border px-3 py-2">Full name &amp; email address</td>
                    <td className="border border-border px-3 py-2">Identify the licensed learner; personalise the training experience; embed dynamic watermark on course videos</td>
                    <td className="border border-border px-3 py-2">Contract performance (Art. 6(1)(b) UK GDPR)</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-3 py-2">Activation code</td>
                    <td className="border border-border px-3 py-2">Verify a valid purchase has been made; prevent unauthorised sharing of access credentials</td>
                    <td className="border border-border px-3 py-2">Contract performance</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-3 py-2">Device identifier</td>
                    <td className="border border-border px-3 py-2">Bond access to a single device (platform security; prevention of credential sharing)</td>
                    <td className="border border-border px-3 py-2">Legitimate interests (Art. 6(1)(f)) — protecting the integrity of a paid vocational qualification</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-3 py-2">Video watch progress &amp; timestamps</td>
                    <td className="border border-border px-3 py-2">Enable resume-on-return; enforce sequential module unlocking; verify completion</td>
                    <td className="border border-border px-3 py-2">Contract performance</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-3 py-2">Quiz &amp; exam scores</td>
                    <td className="border border-border px-3 py-2">Assess competency; gate module progression at the required 80% pass threshold</td>
                    <td className="border border-border px-3 py-2">Contract performance</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-3 py-2">Digital waiver signature</td>
                    <td className="border border-border px-3 py-2">Record informed consent to safety terms prior to accessing chainsaw operating instruction</td>
                    <td className="border border-border px-3 py-2">Legal obligation / legitimate interests</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-3 py-2">Inspection checklist records</td>
                    <td className="border border-border px-3 py-2">Provide a personal chainsaw pre-use safety log; support duty-of-care records for employers</td>
                    <td className="border border-border px-3 py-2">Legitimate interests; legal obligation (PUWER, LOLER)</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-3 py-2">Risk assessment records</td>
                    <td className="border border-border px-3 py-2">Provide a personal dynamic risk assessment log for chainsaw operations; support statutory compliance</td>
                    <td className="border border-border px-3 py-2">Legitimate interests; legal obligation (Management of Health &amp; Safety at Work Regulations 1999)</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-3 py-2">AI chat / mock-test messages</td>
                    <td className="border border-border px-3 py-2">Facilitate AI-assisted exam preparation; improve AI response quality</td>
                    <td className="border border-border px-3 py-2">Contract performance / legitimate interests</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-3 py-2">Module feedback ratings</td>
                    <td className="border border-border px-3 py-2">Improve course content quality</td>
                    <td className="border border-border px-3 py-2">Legitimate interests</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-black uppercase tracking-widest text-xs text-primary mb-2">3. Professional Standards Context</h2>
            <p>
              This platform delivers vocational chainsaw safety training aligned with the standards and assessment frameworks recognised by the <strong>International Institute of Risk and Safety Management (IIRSM)</strong>, the <strong>Forestry Commission</strong>, and the <strong>Arboricultural Association</strong>. Chainsaw operation is a notifiable hazardous activity under UK health and safety law; maintaining accurate training records is a statutory requirement for both the individual operator and their employer.
            </p>
            <p className="mt-2">
              Accordingly, your training record (module completion, quiz and exam results, and digital waiver) may form part of your personal evidence of competence and/or your employer&rsquo;s statutory duty-of-care records under:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Health and Safety at Work etc. Act 1974</li>
              <li>Management of Health and Safety at Work Regulations 1999</li>
              <li>Provision and Use of Work Equipment Regulations 1998 (PUWER)</li>
              <li>Lifting Operations and Lifting Equipment Regulations 1998 (LOLER)</li>
              <li>Forestry Commission &amp; HSE chainsaw competency guidance</li>
            </ul>
          </section>

          <section>
            <h2 className="font-black uppercase tracking-widest text-xs text-primary mb-2">4. Data Retention</h2>
            <p>
              We retain your personal training record for <strong>3 years from the date of your last platform activity</strong>, or such longer period as may be required by applicable health and safety legislation. This retention period reflects the vocational nature of the training and supports ongoing employer and regulatory audit requirements.
            </p>
            <p className="mt-2">
              After the retention period, all personal data is securely deleted or anonymised.
            </p>
          </section>

          <section>
            <h2 className="font-black uppercase tracking-widest text-xs text-primary mb-2">5. Your Rights Under UK GDPR</h2>
            <p>You have the following rights in relation to your personal data:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Right of access</strong> — request a copy of the personal data we hold about you</li>
              <li><strong>Right to rectification</strong> — ask us to correct inaccurate data</li>
              <li><strong>Right to erasure</strong> — ask us to delete your personal data (subject to the retention obligations in section 4)</li>
              <li><strong>Right to restriction</strong> — ask us to restrict processing in certain circumstances</li>
              <li><strong>Right to data portability</strong> — receive your data in a structured, machine-readable format</li>
              <li><strong>Right to object</strong> — object to processing based on legitimate interests</li>
            </ul>
            <p className="mt-2">
              You may exercise the <strong>Right to Erasure directly within this app</strong> using the &ldquo;Delete Account&rdquo; option in the main menu. This will permanently erase all personal data held about you (name, email, device identifier, progress, quiz results, waiver, inspection records, and risk assessments). Your activation code will be marked as used and cannot be reactivated after deletion.
            </p>
            <p className="mt-2">
              For all other rights requests, contact us at <a href="mailto:info@chainsawcourses.com" className="text-primary hover:underline">info@chainsawcourses.com</a>. We will respond within <strong>30 days</strong>.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              You also have the right to lodge a complaint with the <strong>Information Commissioner&rsquo;s Office (ICO)</strong> at <a href="https://ico.org.uk" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">ico.org.uk</a> or by calling 0303 123 1113.
            </p>
          </section>

          <section>
            <h2 className="font-black uppercase tracking-widest text-xs text-primary mb-2">6. Data Security</h2>
            <p>
              All data is transmitted over HTTPS. Your personal data is stored in a securely hosted PostgreSQL database. Access is restricted to authorised personnel only. Passwords and tokens are never stored in plain text. Video streams are delivered via Vimeo&rsquo;s secure CDN with domain-level access restrictions; we do not store video content.
            </p>
            <p className="mt-2">
              The device-lock mechanism means your training account is bound to your device, reducing the risk of unauthorised third-party access to your personal training record.
            </p>
          </section>

          <section>
            <h2 className="font-black uppercase tracking-widest text-xs text-primary mb-2">7. Third-Party Services</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-border">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border px-3 py-2 text-left font-bold uppercase tracking-widest">Service</th>
                    <th className="border border-border px-3 py-2 text-left font-bold uppercase tracking-widest">Purpose</th>
                    <th className="border border-border px-3 py-2 text-left font-bold uppercase tracking-widest">Data Shared</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border px-3 py-2">Vimeo</td>
                    <td className="border border-border px-3 py-2">Video hosting &amp; streaming</td>
                    <td className="border border-border px-3 py-2">IP address (standard CDN delivery); no personal data sent by us</td>
                  </tr>

                  <tr>
                    <td className="border border-border px-3 py-2">OpenAI (via Replit AI proxy)</td>
                    <td className="border border-border px-3 py-2">AI mock-test &amp; tutor responses</td>
                    <td className="border border-border px-3 py-2">Chat message content only (no name, email, or identifiers sent)</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-3 py-2">Replit</td>
                    <td className="border border-border px-3 py-2">Platform hosting &amp; infrastructure</td>
                    <td className="border border-border px-3 py-2">All platform traffic passes through Replit infrastructure; governed by Replit&rsquo;s DPA</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              We do not sell, rent, or share your personal data with any third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="font-black uppercase tracking-widest text-xs text-primary mb-2">8. Cookies &amp; Local Storage</h2>
            <p>
              This application uses browser <strong>localStorage</strong> and <strong>cookies</strong> solely to persist your session credentials (activation code, device identifier, user ID) between visits. No advertising, analytics, or tracking cookies are set. No third-party tracking scripts are loaded.
            </p>
          </section>

          <section>
            <h2 className="font-black uppercase tracking-widest text-xs text-primary mb-2">9. Children</h2>
            <p>
              This platform is intended for adult professionals engaged in or training for chainsaw operation. We do not knowingly collect data from individuals under the age of 18. If you believe a minor has activated an account, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="font-black uppercase tracking-widest text-xs text-primary mb-2">10. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. The version date at the top of this page indicates when it was last revised. Continued use of the platform after a policy update constitutes acceptance of the revised policy.
            </p>
          </section>

          <div className="border-t border-border pt-6 mt-8 text-center text-xs text-muted-foreground print:mt-6">
            <p>Chainsaw Courses &nbsp;&bull;&nbsp; <a href="mailto:info@chainsawcourses.com" className="text-primary hover:underline">info@chainsawcourses.com</a> &nbsp;&bull;&nbsp; <a href="https://chainsawcourses.com" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">chainsawcourses.com</a></p>
            <p className="mt-1">This policy was prepared in accordance with UK GDPR (UK Data Protection Act 2018) and reflects IIRSM vocational training data standards.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
