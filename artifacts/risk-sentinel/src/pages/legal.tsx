import { Link } from 'wouter';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const content = {
  privacy: {
    title: 'Privacy notice',
    intro: 'Risk Sentinel is an early-stage workspace for documenting brand identities and reviewing submitted records. This page describes the current MVP behavior and is not a substitute for a reviewed privacy notice.',
    sections: [
      ['Workspace records', 'Brand identities, submitted profile and app listing details, alert review decisions, evidence strings, and investigation case notes are associated with the signed-in Clerk user. The product is designed for owner-scoped records.'],
      ['Submitted URLs', 'A URL entered for analysis is stored as record data. This MVP does not fetch the URL, contact the target host, or monitor external platforms.'],
      ['Synthetic samples', 'The sample dataset is prepared synthetic material. It is not a live feed and should not be treated as observed platform activity.'],
      ['Authentication and service operation', 'Clerk handles sign-in and account sessions. The application API processes workspace records to provide the requested features. Do not enter sensitive personal information or credentials into records.'],
      ['Retention and requests', 'This MVP does not publish a complete retention schedule or self-service data export process. Contact the workspace operator for privacy questions or deletion requests.'],
      ['Before launch', 'The product owner must have this notice reviewed by qualified privacy counsel, confirm data flows and retention, and update it for the deployment, service providers, and applicable jurisdictions before public launch.'],
    ],
  },
  terms: {
    title: 'Terms and Conditions',
    intro: 'These draft terms describe intended MVP use only. They require owner and legal review before launch and do not create a complete or enforceable agreement.',
    sections: [
      ['Use of the workspace', 'Use Risk Sentinel to maintain brand identity records and support human review of submitted profile or app listing records. You are responsible for having authority to submit and store the information you provide.'],
      ['Analyst judgment', 'Scores and indicators are decision-support information. They do not make an automated fraud determination, establish wrongdoing, or replace independent review of evidence. Do not rely on a score alone for consequential action.'],
      ['No external monitoring', 'The MVP does not crawl, fetch, or monitor social networks, app stores, or other external platforms. Submitted URLs are stored, not visited. Imported samples are synthetic.'],
      ['Your content', 'You remain responsible for the accuracy, rights, and lawful use of brand details, submitted URLs, evidence, and case notes. Avoid unnecessary personal data and confidential credentials.'],
      ['Service status', 'The MVP is provided for evaluation. Availability, retention, security commitments, support, and service levels are not specified here.'],
      ['Before launch', 'The owner must obtain legal review, define acceptable-use, limitation, jurisdiction, dispute, and service terms, and confirm the operational commitments before making the service available to users.'],
    ],
  },
};

export default function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const page = content[kind];
  return <div className="legal-page"><header className="landing-nav"><Link href="/" className="brand-mark landing-brand"><span className="brand-glyph"><ShieldCheck size={20} /></span><span>risk<span className="brand-light">sentinel</span></span></Link><Link href="/" className="landing-signin"><ArrowLeft size={14} /> Home</Link></header><main className="legal-main"><Link href="/" className="back-link"><ArrowLeft size={15} /> Back to Risk Sentinel</Link><div className="eyebrow">RISK SENTINEL / {kind.toUpperCase()}</div><h1>{page.title}</h1><p className="legal-intro">{page.intro}</p><div className="legal-review-notice"><strong>Draft for review</strong><span>This page reflects current MVP behavior. Owner and legal review is required before launch.</span></div>{page.sections.map(([heading, body], index) => <section className="legal-section" key={heading}><span className="legal-index">0{index + 1}</span><div><h2>{heading}</h2><p>{body}</p></div></section>)}</main><footer className="landing-footer"><Link href="/" className="brand-mark"><span className="brand-glyph"><ShieldCheck size={17} /></span><span>risk<span className="brand-light">sentinel</span></span></Link><span>Digital risk, kept in context.</span><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></footer></div>;
}
