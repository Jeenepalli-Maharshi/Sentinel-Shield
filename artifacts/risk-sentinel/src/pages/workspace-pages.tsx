import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { ArrowRight, ArrowUpRight, Building2, ExternalLink, FileSearch, Filter, Plus, Search, ShieldAlert, Sparkles } from 'lucide-react';
import {
  getGetAlertQueryKey, getGetOverviewQueryKey, getListAlertsQueryKey, getListBrandsQueryKey, getListCasesQueryKey,
  useCreateBrand, useCreateCase, useDeleteBrand, useGetOverview, useImportSampleDataset,
  useGetAlert, useListAlerts, useListBrands, useListCases, useReviewAlert, useSubmitMonitoringRecord,
  useUpdateBrand, useUpdateCase,
} from '@workspace/api-client-react';
import type { Alert, Brand, Case, CaseInput, CaseStatus, CaseUpdate, ReviewStatus, Severity } from '@workspace/api-client-react';
import { Button, EmptyState, Field, LoadingRows, Modal, PageError, SeverityTag, StatusTag, Workspace } from '@/components/workspace';

const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

export function DashboardPage() {
  const overview = useGetOverview();
  const brands = useListBrands();
  return <Workspace title="Overview" eyebrow="YOUR WORKSPACE">
    {overview.isLoading ? <LoadingRows count={4} /> : overview.isError ? <PageError onRetry={() => overview.refetch()} /> : overview.data && <div className="dashboard-content">
      <div className="overview-intro"><div><h2>Your review desk</h2><p>Work from registered identity to evidence-backed decisions.</p></div><Link href="/alerts" className="button button-primary">Review alerts <ArrowRight size={16} /></Link></div>
      <div className="metric-grid">{[{ label: 'Registered brands', value: overview.data.brandCount, icon: Building2, foot: 'Identity records' }, { label: 'Open alerts', value: overview.data.openAlerts, icon: FileSearch, foot: 'Awaiting review' }, { label: 'High severity', value: overview.data.highRiskAlerts, icon: ShieldAlert, foot: 'Analyst attention' }, { label: 'Active cases', value: overview.data.activeCases, icon: Filter, foot: 'In progress' }].map(metric => { const Icon = metric.icon; return <div className="metric-card" key={metric.label}><div className="metric-top"><span>{metric.label}</span><Icon size={17} /></div><strong>{metric.value}</strong><small>{metric.foot}</small></div>; })}</div>
      <div className="dashboard-lower"><section className="panel recent-panel"><div className="panel-heading"><div><div className="eyebrow">LATEST RECORDS</div><h2>Recent alerts</h2></div><Link href="/alerts" className="subtle-link">View all <ArrowRight size={14} /></Link></div>{overview.data.recentAlerts.length ? <div className="recent-list">{overview.data.recentAlerts.map(alert => <AlertRow alert={alert} key={alert.id} />)}</div> : <EmptyState title="No alerts in the workspace" body="Submitted records and synthetic samples will appear here for analyst review." action={<Link href="/alerts" className="text-action">Open alerts <ArrowRight size={14} /></Link>} />}</section>
        <section className="panel severity-panel"><div className="eyebrow">SEVERITY BREAKDOWN</div><h2>Signals to review</h2><p className="panel-copy">A score is a review aid, not an automated finding.</p>{(['high', 'medium', 'low'] as const).map(level => <div className="severity-meter" key={level}><div><SeverityTag value={level} /><span>{overview.data.severityCounts[level]}</span></div><div className="meter-track"><i className={`meter-${level}`} style={{ width: `${overview.data.severityCounts[level] ? Math.max(7, overview.data.severityCounts[level] / Math.max(overview.data.openAlerts, 1) * 100) : 0}%` }} /></div></div>)}</section></div>
      {brands.isLoading ? <LoadingRows count={1} /> : !brands.data?.length && <div className="setup-banner"><div className="setup-symbol"><Building2 size={20} /></div><div><b>Start with an official identity record</b><p>Register a brand before submitting a profile or listing for analysis.</p></div><Link href="/brands" className="button button-outline">Register brand</Link></div>}
    </div>}
  </Workspace>;
}

function AlertRow({ alert, onClick }: { alert: Alert; onClick?: () => void }) {
  const content = <><span className={`row-score score-${alert.severity}`}>{alert.score}</span><span className="row-main"><b>{alert.targetName}</b><small>{alert.brandName} <span>·</span> {alert.source} <span>·</span> {alert.recordType === 'social_profile' ? 'Social profile' : 'App listing'}</small></span><SeverityTag value={alert.severity} /><span className="row-date">{dateLabel(alert.createdAt)}</span><ArrowUpRight size={15} className="row-arrow" /></>;
  return onClick ? <button className="alert-row" onClick={onClick} data-testid={`button-alert-${alert.id}`}>{content}</button> : <Link href={`/alerts?selected=${encodeURIComponent(alert.id)}`} className="alert-row">{content}</Link>;
}

type BrandForm = { name: string; officialDomain: string; logoUrl: string; socialHandles: string; appIdentifiers: string };
const emptyBrand: BrandForm = { name: '', officialDomain: '', logoUrl: '', socialHandles: '', appIdentifiers: '' };
function toBrandInput(form: BrandForm) {
  return { name: form.name.trim(), officialDomain: form.officialDomain.trim(), logoUrl: form.logoUrl.trim() || null, socialHandles: form.socialHandles.split(',').map(v => v.trim()).filter(Boolean), appIdentifiers: form.appIdentifiers.split(',').map(v => v.trim()).filter(Boolean) };
}
function brandToForm(brand: Brand): BrandForm {
  return { name: brand.name, officialDomain: brand.officialDomain, logoUrl: brand.logoUrl ?? '', socialHandles: brand.socialHandles.join(', '), appIdentifiers: brand.appIdentifiers.join(', ') };
}

export function BrandsPage() {
  const queryClient = useQueryClient();
  const brands = useListBrands();
  const create = useCreateBrand();
  const update = useUpdateBrand();
  const remove = useDeleteBrand();
  const importSamples = useImportSampleDataset();
  const submitRecord = useSubmitMonitoringRecord();
  const [editing, setEditing] = useState<Brand | null>(null);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState<Brand | null>(null);
  const [sampleBrand, setSampleBrand] = useState<Brand | null>(null);
  const [form, setForm] = useState<BrandForm>(emptyBrand);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetOverviewQueryKey() }); };
  const startNew = () => { setError(''); setForm(emptyBrand); setEditing(null); setCreating(true); };
  const startEdit = (brand: Brand) => { setError(''); setForm(brandToForm(brand)); setEditing(brand); setCreating(true); };
  const closeForm = () => { setCreating(false); setError(''); };
  const saveBrand = (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (form.name.trim().length < 2 || form.officialDomain.trim().length < 3) { setError('Enter a brand name and official domain.'); return; }
    const data = toBrandInput(form);
    if (editing) update.mutate({ brandId: editing.id, data }, { onSuccess: () => { invalidate(); closeForm(); setNotice('Brand identity updated.'); }, onError: e => setError(errorText(e)) });
    else create.mutate({ data }, { onSuccess: () => { invalidate(); closeForm(); setNotice('Brand identity registered.'); }, onError: e => setError(errorText(e)) });
  };
  const deleteBrand = (brand: Brand) => {
    if (!window.confirm(`Delete ${brand.name} and its related records? This cannot be undone.`)) return;
    remove.mutate({ brandId: brand.id }, { onSuccess: () => { invalidate(); setNotice(`${brand.name} deleted.`); }, onError: e => setError(errorText(e)) });
  };
  const importSynthetic = () => {
    if (!sampleBrand) return;
    setError('');
    importSamples.mutate({ data: { brandId: sampleBrand.id } }, { onSuccess: result => { invalidate(); void queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() }); setNotice(`${result.imported} synthetic sample record${result.imported === 1 ? '' : 's'} imported.`); setSampleBrand(null); }, onError: e => setError(errorText(e)) });
  };
  const submitCandidate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!submitting) return; setError('');
    const data = new FormData(event.currentTarget);
    submitRecord.mutate({ data: { brandId: submitting.id, recordType: data.get('recordType') as 'social_profile' | 'app_listing', source: String(data.get('source')).trim(), targetName: String(data.get('targetName')).trim(), targetHandle: String(data.get('targetHandle')).trim(), targetUrl: String(data.get('targetUrl')).trim(), claimedDomain: String(data.get('claimedDomain') ?? '').trim() || null, logoObservation: data.get('logoObservation') as 'match' | 'mismatch' | 'unknown', behavior: Number(data.get('behavior')) } }, { onSuccess: () => { invalidate(); void queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() }); setSubmitting(null); setNotice('Record submitted for analyst review. The URL was stored but not fetched.'); }, onError: e => setError(errorText(e)) });
  };
  return <Workspace title="Brands" eyebrow="IDENTITY REGISTER">
    <div className="page-toolbar"><div><p>Official identity records define the reference details your team recognizes.</p></div><Button onClick={startNew}><Plus size={16} /> Register brand</Button></div>
    {notice && <div className="inline-notice"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notice">×</button></div>}{error && !creating && <div className="inline-error" role="alert">{error}</div>}
    {brands.isLoading ? <LoadingRows count={4} /> : brands.isError ? <PageError onRetry={() => brands.refetch()} /> : brands.data?.length ? <div className="brand-grid">{brands.data.map(brand => <article className="brand-card" key={brand.id}><div className="brand-card-top"><div className="brand-monogram">{brand.name.slice(0, 1).toUpperCase()}</div><span className="registered-stamp"><span /> REGISTERED</span></div><h2>{brand.name}</h2><a className="domain-link" href={brand.officialDomain.startsWith('http') ? brand.officialDomain : `https://${brand.officialDomain}`} target="_blank" rel="noreferrer">{brand.officialDomain}<ExternalLink size={13} /></a><div className="brand-meta"><div><span>SOCIAL IDENTIFIERS</span><b>{brand.socialHandles.length ? brand.socialHandles.join(', ') : 'None added'}</b></div><div><span>APP IDENTIFIERS</span><b>{brand.appIdentifiers.length ? brand.appIdentifiers.join(', ') : 'None added'}</b></div></div><div className="brand-card-footer"><span>Added {dateLabel(brand.createdAt)}</span><div><button onClick={() => startEdit(brand)} data-testid={`button-edit-brand-${brand.id}`}>Edit</button><button onClick={() => setSubmitting(brand)} data-testid={`button-submit-record-${brand.id}`}>Submit record</button><button onClick={() => setSampleBrand(brand)} data-testid={`button-import-samples-${brand.id}`}>Samples</button><button className="delete-text" onClick={() => deleteBrand(brand)} disabled={remove.isPending} data-testid={`button-delete-brand-${brand.id}`}>Delete</button></div></div></article>)}</div> : <EmptyState title="No brand identities yet" body="Add the official domains and identifiers that your analysts use as a reference." action={<Button onClick={startNew}><Plus size={15} /> Register first brand</Button>} />}
    {creating && <Modal title={editing ? 'Edit brand identity' : 'Register a brand'} description="These details are private to your account and can be updated later." onClose={closeForm}><form className="form-stack" onSubmit={saveBrand}><Field label="Brand name"><input autoFocus required minLength={2} maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-brand-name" /></Field><Field label="Official domain" hint="Enter a domain such as example.com"><input required minLength={3} value={form.officialDomain} onChange={e => setForm({ ...form, officialDomain: e.target.value })} data-testid="input-brand-domain" /></Field><Field label="Logo URL" hint="Optional, retained as a reference only"><input type="url" value={form.logoUrl} onChange={e => setForm({ ...form, logoUrl: e.target.value })} data-testid="input-brand-logo" /></Field><Field label="Social handles" hint="Separate multiple handles with commas"><textarea value={form.socialHandles} onChange={e => setForm({ ...form, socialHandles: e.target.value })} data-testid="input-brand-handles" /></Field><Field label="App identifiers" hint="Separate multiple identifiers with commas"><textarea value={form.appIdentifiers} onChange={e => setForm({ ...form, appIdentifiers: e.target.value })} data-testid="input-brand-apps" /></Field>{error && <p className="form-error">{error}</p>}<div className="form-actions"><Button type="button" variant="outline" onClick={closeForm}>Cancel</Button><Button type="submit" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'Saving…' : editing ? 'Save changes' : 'Register brand'}</Button></div></form></Modal>}
    {sampleBrand && <Modal title="Import synthetic samples" description={`Add prepared synthetic alerts associated with ${sampleBrand.name}. These are examples, not external platform activity.`} onClose={() => setSampleBrand(null)}><div className="synthetic-callout"><Sparkles size={18} /><p>Sample records are synthetic and do not come from live monitoring.</p></div>{error && <p className="form-error">{error}</p>}<div className="form-actions"><Button variant="outline" onClick={() => setSampleBrand(null)}>Cancel</Button><Button onClick={importSynthetic} disabled={importSamples.isPending}>{importSamples.isPending ? 'Importing…' : 'Import samples'}</Button></div></Modal>}
    {submitting && <Modal title="Submit a record" description="The URL is stored as data. This service does not visit or fetch the submitted address." onClose={() => setSubmitting(null)}><form className="form-stack" onSubmit={submitCandidate}><Field label="Record type"><select name="recordType"><option value="social_profile">Social profile</option><option value="app_listing">App listing</option></select></Field><Field label="Source platform or store"><input name="source" required minLength={2} maxLength={80} placeholder="Platform or app store name" /></Field><Field label="Target name"><input name="targetName" required minLength={2} maxLength={160} /></Field><Field label="Target handle"><input name="targetHandle" maxLength={160} /></Field><Field label="Profile or listing URL"><input name="targetUrl" type="url" maxLength={2048} required /></Field><Field label="Claimed linked domain" hint="Optional. Enter the website the profile or listing claims to represent."><input name="claimedDomain" maxLength={253} placeholder="example.com" /></Field><Field label="Logo observation"><select name="logoObservation"><option value="unknown">Not assessed</option><option value="match">Appears to match</option><option value="mismatch">Appears different</option></select></Field><Field label="Behavior signal" hint="Analyst-provided signal from 0 to 100"><input name="behavior" type="number" min="0" max="100" defaultValue="0" /></Field>{error && <p className="form-error">{error}</p>}<div className="form-actions"><Button type="button" variant="outline" onClick={() => setSubmitting(null)}>Cancel</Button><Button type="submit" disabled={submitRecord.isPending}>{submitRecord.isPending ? 'Submitting…' : 'Submit for review'}</Button></div></form></Modal>}
  </Workspace>;
}

function AlertReviewDialog({ alert: initialAlert, onClose }: { alert: Alert; onClose: () => void }) {
  const alertQuery = useGetAlert(initialAlert.id, { query: { queryKey: getGetAlertQueryKey(initialAlert.id) } });
  const alert = alertQuery.data ?? initialAlert;
  const queryClient = useQueryClient();
  const review = useReviewAlert();
  const createCase = useCreateCase();
  const [note, setNote] = useState('');
  const [caseTitle, setCaseTitle] = useState(`Review: ${alert.targetName}`);
  const [casePriority, setCasePriority] = useState<Severity>(alert.severity);
  const [caseOpen, setCaseOpen] = useState(false);
  const [error, setError] = useState('');
  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetOverviewQueryKey() }); void queryClient.invalidateQueries({ queryKey: getListCasesQueryKey() }); };
  const mark = (status: ReviewStatus) => {
    setError('');
    review.mutate({ alertId: alert.id, data: { status, note: note.trim() || undefined } }, { onSuccess: () => { invalidate(); onClose(); }, onError: e => setError(errorText(e)) });
  };
  const createInvestigation = (event: FormEvent) => {
    event.preventDefault(); setError('');
    const data: CaseInput = { alertId: alert.id, title: caseTitle.trim(), priority: casePriority };
    createCase.mutate({ data }, { onSuccess: () => { invalidate(); onClose(); }, onError: e => setError(errorText(e)) });
  };
  return <Modal title="Evidence review" description={`${alert.brandName} / ${alert.source} / ${dateLabel(alert.createdAt)}`} onClose={onClose}><div className="review-subject"><div className={`row-score score-${alert.severity}`}>{alert.score}</div><div><h3>{alert.targetName}</h3><p>{alert.targetHandle} <span>·</span> {alert.recordType === 'social_profile' ? 'Social profile' : 'App listing'} <span>·</span> <StatusTag value={alert.status} /></p></div><SeverityTag value={alert.severity} /></div><a className="target-url" href={alert.targetUrl} target="_blank" rel="noreferrer">{alert.targetUrl}<ExternalLink size={13} /></a><div className="review-summary"><span className="eyebrow">SUMMARY</span><p>{alert.summary}</p></div><div className="components-grid">{Object.entries(alert.components).map(([key, value]) => <div key={key}><span>{key.replace(/([A-Z])/g, ' $1')}</span><b>{value}<small>/100</small></b><i><u style={{ width: `${value}%` }} /></i></div>)}</div><div className="evidence-block"><div className="eyebrow">EVIDENCE ON FILE <span>({alert.evidence.length})</span></div>{alert.evidence.length ? <ul>{alert.evidence.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul> : <p>No evidence items were provided with this record.</p>}</div><Field label="Analyst note" hint="Your note accompanies the review decision."><textarea value={note} maxLength={2000} onChange={e => setNote(e.target.value)} placeholder="Record what the available evidence supports." /></Field>{error && <p className="form-error">{error}</p>}{caseOpen ? <form className="case-create-inline" onSubmit={createInvestigation}><div className="eyebrow">OPEN AN INVESTIGATION</div><Field label="Case title"><input required minLength={3} maxLength={160} value={caseTitle} onChange={e => setCaseTitle(e.target.value)} /></Field><Field label="Priority"><select value={casePriority} onChange={e => setCasePriority(e.target.value as Severity)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></Field><div className="form-actions"><Button type="button" variant="outline" onClick={() => setCaseOpen(false)}>Back</Button><Button type="submit" disabled={createCase.isPending}>{createCase.isPending ? 'Creating…' : 'Create case'}</Button></div></form> : <div className="review-actions"><Button variant="outline" onClick={() => mark('dismissed')} disabled={review.isPending}>Dismiss</Button><Button variant="outline" onClick={() => mark('confirmed')} disabled={review.isPending}>Confirm for follow-up</Button><Button onClick={() => setCaseOpen(true)}>Open case</Button></div>}</Modal>;
}

export function AlertsPage() {
  const [location, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [selected, setSelected] = useState<Alert | null>(null);
  const params = useMemo(() => ({ ...(search ? { search } : {}), ...(status ? { status: status as ReviewStatus } : {}), ...(severity ? { severity: severity as Severity } : {}) }), [search, status, severity]);
  const alerts = useListAlerts(params);
  const selectedId = new URLSearchParams(location.split('?')[1] ?? '').get('selected');
  useEffect(() => {
    if (!selectedId || !alerts.data) return;
    const match = alerts.data.find(alert => alert.id === selectedId);
    if (match) setSelected(match);
    setLocation('/alerts', { replace: true });
  }, [selectedId, alerts.data, setLocation]);
  return <Workspace title="Alerts" eyebrow="REVIEW QUEUE"><div className="page-toolbar"><p>Search submitted records and imported synthetic examples. Scores support analyst review.</p><Link href="/brands" className="button button-outline"><Plus size={15} /> Submit a record</Link></div><div className="filter-bar"><label className="search-box"><Search size={17} /><input type="search" placeholder="Search targets, brands, source…" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-alert-search" /></label><select value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status" data-testid="select-alert-status"><option value="">All statuses</option>{['open', 'reviewing', 'confirmed', 'dismissed', 'escalated'].map(v => <option key={v} value={v}>{v}</option>)}</select><select value={severity} onChange={e => setSeverity(e.target.value)} aria-label="Filter by severity" data-testid="select-alert-severity"><option value="">All severity</option>{['high', 'medium', 'low'].map(v => <option key={v} value={v}>{v}</option>)}</select></div>{alerts.isLoading ? <LoadingRows count={5} /> : alerts.isError ? <PageError onRetry={() => alerts.refetch()} /> : alerts.data?.length ? <div className="panel alert-list">{alerts.data.map(alert => <AlertRow alert={alert} key={alert.id} onClick={() => setSelected(alert)} />)}</div> : <EmptyState title="Nothing to review" body={search || status || severity ? 'No records match these filters. Try a different search.' : 'Submit a record from a brand or import a synthetic sample to begin a review.'} action={!search && !status && !severity ? <Link href="/brands" className="text-action">Go to brands <ArrowRight size={14} /></Link> : undefined} />}{selected && <AlertReviewDialog alert={selected} onClose={() => setSelected(null)} />}</Workspace>;
}

export function CasesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Case | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const params = useMemo(() => ({ ...(search ? { search } : {}), ...(status ? { status: status as CaseStatus } : {}) }), [search, status]);
  const cases = useListCases(params);
  const update = useUpdateCase();
  const saveCase = (event: FormEvent) => {
    event.preventDefault(); if (!editing) return; setError('');
    const data: CaseUpdate = { analystNote: note };
    update.mutate({ caseId: editing.id, data }, { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getListCasesQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetOverviewQueryKey() }); setEditing(null); }, onError: e => setError(errorText(e)) });
  };
  const changeStatus = (item: Case, next: CaseStatus) => {
    update.mutate({ caseId: item.id, data: { status: next } }, { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getListCasesQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetOverviewQueryKey() }); }, onError: e => setError(errorText(e)) });
  };
  return <Workspace title="Cases" eyebrow="INVESTIGATIONS"><div className="page-toolbar"><p>Carry alert context into a case and keep analyst notes with the investigation.</p><span className="read-only-label">Cases begin from an alert</span></div><div className="filter-bar"><label className="search-box"><Search size={17} /><input type="search" placeholder="Search cases or targets…" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-case-search" /></label><select value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All case statuses</option><option value="open">Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option></select></div>{error && <div className="inline-error">{error}</div>}{cases.isLoading ? <LoadingRows count={4} /> : cases.isError ? <PageError onRetry={() => cases.refetch()} /> : cases.data?.length ? <div className="case-list">{cases.data.map(item => <article className="case-card" key={item.id}><div className="case-accent" /><div className="case-content"><div className="case-topline"><span className="case-ref">CASE / {item.id.slice(0, 8).toUpperCase()}</span><SeverityTag value={item.priority} /><StatusTag value={item.status} /></div><h2>{item.title}</h2><p>{item.brandName} <span>·</span> {item.targetName}</p><div className="case-note-preview">{item.analystNote || 'No analyst note added yet.'}</div><div className="case-bottom"><span>Updated {dateLabel(item.updatedAt)}</span><div><button onClick={() => { setEditing(item); setNote(item.analystNote); setError(''); }} data-testid={`button-edit-case-${item.id}`}>Edit notes</button><select aria-label={`Update ${item.title} status`} value={item.status} onChange={e => changeStatus(item, e.target.value as CaseStatus)} data-testid={`select-case-status-${item.id}`}><option value="open">Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option></select><Link href={`/alerts?selected=${encodeURIComponent(item.alertId)}`} className="case-alert-link">View alert <ArrowUpRight size={13} /></Link></div></div></div></article>)}</div> : <EmptyState title="No investigations yet" body="Open a case from an alert when the evidence needs continued investigation." action={<Link href="/alerts" className="text-action">Review alerts <ArrowRight size={14} /></Link>} />}{editing && <Modal title="Update case notes" description={editing.title} onClose={() => setEditing(null)}><form className="form-stack" onSubmit={saveCase}><Field label="Analyst note" hint="Keep notes evidence-based. Up to 5,000 characters."><textarea value={note} maxLength={5000} rows={7} onChange={e => setNote(e.target.value)} /></Field>{error && <p className="form-error">{error}</p>}<div className="form-actions"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save notes'}</Button></div></form></Modal>}</Workspace>;
}
