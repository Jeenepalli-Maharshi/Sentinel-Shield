import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useClerk, useUser } from '@clerk/react';
import { Activity, ArrowUpRight, Bell, BriefcaseBusiness, Building2, ChevronRight, CircleHelp, LogOut, Menu, ShieldCheck, X } from 'lucide-react';

const links = [
  { href: '/dashboard', label: 'Overview', icon: Activity },
  { href: '/brands', label: 'Brands', icon: Building2 },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/cases', label: 'Cases', icon: BriefcaseBusiness },
];

export function Workspace({ children, title, eyebrow }: { children: ReactNode; title: string; eyebrow?: string }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const nav = <><div className="brand-mark"><span className="brand-glyph"><ShieldCheck size={20} strokeWidth={1.8} /></span><span>risk<span className="brand-light">sentinel</span></span></div><div className="workspace-label">WORKSPACE</div><nav className="side-nav">{links.map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`nav-link ${location === item.href ? 'active' : ''}`} data-testid={`link-nav-${item.label.toLowerCase()}`}><Icon size={18} /><span>{item.label}</span>{location === item.href && <ChevronRight size={15} className="nav-current" />}</Link>; })}</nav><div className="sidebar-bottom"><div className="side-note"><span className="note-mark"><ShieldCheck size={15} /></span><p>Evidence first.<br />Analyst judgment always.</p></div><Link href="/privacy" className="nav-link legal-link"><CircleHelp size={17} /><span>Privacy & terms</span><ArrowUpRight size={13} /></Link><button className="nav-link logout-link" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })} data-testid="button-sign-out"><LogOut size={17} /><span>Sign out</span></button></div></>;
  return <div className="app-shell"><aside className="sidebar">{nav}</aside>{mobileOpen && <div className="mobile-sidebar"><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={20} /></button>{nav}</div>}<main className="main-frame"><header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button><span className="topbar-context">Risk operations <span>/</span> {title}</span><div className="topbar-right"><span className="secure-state"><i /> Private workspace</span><div className="user-avatar" title={user?.fullName ?? 'Analyst'}>{user?.firstName?.[0] ?? 'A'}</div></div></header><section className="page-wrap rise"><div className="page-heading">{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1></div>{children}</section><footer className="workspace-footer"><span>Risk Sentinel</span><span>Scores are signals for analyst review, not determinations of fraud.</span></footer></main></div>;
}

export function Button({ children, variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'quiet' | 'danger' }) {
  return <button {...props} className={`button button-${variant} ${props.className ?? ''}`}>{children}</button>;
}

export function PageError({ onRetry }: { onRetry: () => void }) {
  return <div className="state-card"><div className="state-symbol">!</div><h2>We could not load this view</h2><p>Check your connection and try again. Your workspace data remains private to your account.</p><Button variant="outline" onClick={onRetry}>Try again</Button></div>;
}

export function LoadingRows({ count = 3 }: { count?: number }) {
  return <div className="skeleton-list" aria-label="Loading"><div className="skeleton-line skeleton-wide" />{Array.from({ length: count }, (_, i) => <div className="skeleton-row" key={i}><span /><span /><span /></div>)}</div>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><ShieldCheck size={21} /></div><h3>{title}</h3><p>{body}</p>{action}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Modal({ title, description, children, onClose }: { title: string; description?: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></div>{children}</section></div>;
}

export function SeverityTag({ value }: { value: string }) {
  return <span className={`severity severity-${value}`}>{value}</span>;
}

export function StatusTag({ value }: { value: string }) {
  return <span className={`status status-${value}`}>{value.replaceAll('_', ' ')}</span>;
}
