"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAdapter,
  type CheckName,
  type ReleaseGatePayload,
  type ReleaseGateResult,
  type ReleaseGateSummary,
  type SubmissionUpdate,
  type TransactionPhase,
} from "@/lib/genlayer";

const adapter = getAdapter();

const CHECK_LABELS: { id: CheckName; label: string }[] = [
  { id: "criteria", label: "Criteria" },
  { id: "build", label: "Build" },
  { id: "tests", label: "Tests" },
  { id: "deployment", label: "Deployment" },
];

const PHASES: TransactionPhase[] = ["signing", "submitted", "consensus", "accepted", "verifying", "complete"];

const EMPTY_SUMMARY: ReleaseGateSummary = { total: 0, ready: 0, blocked: 0, needs_review: 0 };

const EMPTY_FORM: ReleaseGatePayload = {
  release_criteria: "",
  build_evidence: "",
  test_evidence: "",
  deployment_evidence: "",
  known_risks: "",
};

const VERDICT_LABELS: Record<string, string> = {
  ready: "Ready",
  blocked: "Blocked",
  needs_review: "Needs review",
};

function makeRequestId(): string {
  return `release-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function compact(value: string, head = 8, tail = 6): string {
  return value.length > head + tail + 3 ? `${value.slice(0, head)}...${value.slice(-tail)}` : value;
}

function formatTime(timestamp: number): string {
  if (!timestamp) return "Time not recorded";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

function validate(form: ReleaseGatePayload): Partial<Record<keyof ReleaseGatePayload, string>> {
  const errors: Partial<Record<keyof ReleaseGatePayload, string>> = {};
  if (!form.release_criteria.trim()) errors.release_criteria = "Define the criteria a release must meet.";
  if (!form.build_evidence.trim()) errors.build_evidence = "Add build evidence.";
  if (!form.test_evidence.trim()) errors.test_evidence = "Add test evidence.";
  if (!form.deployment_evidence.trim()) errors.deployment_evidence = "Add deployment evidence.";
  return errors;
}

function Field({
  id,
  label,
  helper,
  value,
  error,
  rows,
  maxLength,
  optional,
  onChange,
}: {
  id: keyof ReleaseGatePayload;
  label: string;
  helper: string;
  value: string;
  error?: string;
  rows: number;
  maxLength: number;
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <div className="label-row">
        <label htmlFor={id}>{label}{optional ? <span className="optional">Optional</span> : null}</label>
        <span className="count">{value.length}/{maxLength}</span>
      </div>
      <p id={helperId} className="helper">{helper}</p>
      <textarea
        id={id}
        name={id}
        rows={rows}
        maxLength={maxLength}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={`${helperId}${error ? ` ${errorId}` : ""}`}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p id={errorId} className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}

function ResultPanel({ result, explorerUrl }: { result: ReleaseGateResult; explorerUrl?: string }) {
  return (
    <section className="result-panel" aria-labelledby="result-title">
      <div className="result-head">
        <div>
          <p className="section-kicker">Canonical verdict</p>
          <h2 id="result-title" className={`verdict verdict-${result.verdict}`}>{VERDICT_LABELS[result.verdict] ?? result.verdict}</h2>
        </div>
        <span className="confidence">{result.confidence} confidence</span>
        {result.transaction_hash ? <code className="result-hash">{compact(result.transaction_hash)}</code> : null}
      </div>
      <p className="explanation">{result.explanation}</p>

      <div className="checks-grid">
        {CHECK_LABELS.map(({ id, label }) => {
          const check = result.checks[id];
          if (!check) return null;
          return (
            <article key={id} className={`check check-${check.status}`}>
              <header><h3>{label}</h3><span className={`tag tag-${check.status}`}>{check.status}</span></header>
              <p>{check.detail}</p>
              {check.snippet ? <blockquote>{check.snippet}</blockquote> : null}
            </article>
          );
        })}
      </div>

      {result.blockers.length > 0 && (
        <div className="blockers">
          <h3>Blockers</h3>
          <ul>{result.blockers.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </div>
      )}

      <dl className="result-meta">
        <div><dt>Request</dt><dd>{result.request_id}</dd></div>
        <div><dt>Sender</dt><dd>{compact(result.sender)}</dd></div>
        <div><dt>Recorded</dt><dd>{formatTime(result.created_at)}</dd></div>
      </dl>

      {explorerUrl ? <a className="text-link" href={explorerUrl} target="_blank" rel="noreferrer">Inspect transaction</a> : null}
    </section>
  );
}

export default function Home() {
  const [form, setForm] = useState<ReleaseGatePayload>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof ReleaseGatePayload, string>>>({});
  const [wallet, setWallet] = useState<string | null>(null);
  const [phase, setPhase] = useState<TransactionPhase>("idle");
  const [status, setStatus] = useState("Ready for release evidence.");
  const [hash, setHash] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | undefined>();
  const [result, setResult] = useState<ReleaseGateResult | null>(null);
  const [recent, setRecent] = useState<ReleaseGateResult[]>([]);
  const [summary, setSummary] = useState<ReleaseGateSummary>(EMPTY_SUMMARY);
  const [error, setError] = useState<string | null>(null);
  const recovering = useRef(false);

  const busy = !["idle", "complete", "failed"].includes(phase);
  const phaseIndex = PHASES.indexOf(phase);
  const networkLabel = adapter.mode === "mock" ? "Simulator" : adapter.network;

  const refresh = useCallback(async () => {
    const [nextSummary, nextRecent] = await Promise.all([adapter.getSummary(), adapter.getResults(0, 6)]);
    setSummary(nextSummary);
    setRecent(nextRecent);
  }, []);

  const onProgress = useCallback((update: SubmissionUpdate) => {
    setPhase(update.phase);
    setStatus(update.message);
    if (update.hash) setHash(update.hash);
    if (update.explorerUrl) setExplorerUrl(update.explorerUrl);
    if (update.result) setResult(update.result);
  }, []);

  useEffect(() => {
    void refresh().catch(() => setError("Recent canonical results could not be loaded."));
    const pending = adapter.getPendingTransaction();
    if (!pending || recovering.current) return;
    recovering.current = true;
    setHash(pending.hash);
    setExplorerUrl(adapter.getExplorerUrl(pending.hash) ?? undefined);
    setStatus("Recovering the saved transaction hash.");
    void adapter.recoverPending(onProgress)
      .then(async (recovered) => {
        if (recovered) setResult(recovered);
        setWallet(adapter.getIdentityAddress());
        await refresh();
      })
      .catch((cause) => {
        setPhase("failed");
        setError(cause instanceof Error ? cause.message : "The saved transaction could not be recovered.");
      });
  }, [onProgress, refresh]);

  function updateField(key: keyof ReleaseGatePayload, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function connect() {
    setError(null);
    try {
      const address = await adapter.connectWallet(onProgress);
      setWallet(address);
      setPhase("idle");
      setStatus("Wallet connected. Ready for release evidence.");
    } catch (cause) {
      setPhase("failed");
      setError(cause instanceof Error ? cause.message : "Wallet connection failed.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setError("Review the marked fields before submitting.");
      document.getElementById(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    setError(null);
    setResult(null);
    setHash(null);
    setExplorerUrl(undefined);
    try {
      const canonical = await adapter.submitCheck(makeRequestId(), form, onProgress);
      setResult(canonical);
      setWallet(adapter.getIdentityAddress());
      await refresh();
    } catch (cause) {
      setPhase("failed");
      setError(cause instanceof Error ? cause.message : "The release check failed.");
    }
  }

  const counts = useMemo(() => [
    ["Ready", summary.ready],
    ["Blocked", summary.blocked],
    ["Needs review", summary.needs_review],
  ] as const, [summary]);

  return (
    <main id="main-content">
      <a className="skip-link" href="#gate-form">Skip to evidence form</a>
      <header className="topbar">
        <a className="brand" href="#main-content" aria-label="ReleaseGate home">
          <span className="brand-mark" aria-hidden="true">RG</span>
          <span>ReleaseGate</span>
        </a>
        <div className="network">
          <span>{networkLabel}</span>
          {wallet ? <code>{compact(wallet)}</code> : <button className="quiet-button" type="button" onClick={connect}>Connect wallet</button>}
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="section-kicker">Consensus release readiness</p>
          <h1 id="hero-title">Ship only when<br /><span>the evidence agrees.</span></h1>
          <p className="hero-lede">Submit your release criteria with build, test, and deployment evidence. Independent GenLayer validators persist one grounded verdict: ready, blocked, or needs review.</p>
        </div>
        <div className="gate-index" aria-label="Canonical result counts">
          <div className="total-count"><strong>{summary.total}</strong><span>canonical gates</span></div>
          <dl>
            {counts.map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}
          </dl>
        </div>
      </section>

      <section className="workspace" aria-label="Release gate workspace">
        <form id="gate-form" className="gate-form" onSubmit={submit} noValidate>
          <div className="form-heading">
            <div>
              <p className="section-kicker">Evidence intake</p>
              <h2>Build the gate</h2>
            </div>
            <span>4 required fields</span>
          </div>
          <Field id="release_criteria" label="Release criteria" helper="Define the conditions a release must satisfy to ship." value={form.release_criteria} error={errors.release_criteria} rows={4} maxLength={3000} onChange={(value) => updateField("release_criteria", value)} />
          <Field id="build_evidence" label="Build evidence" helper="Build status, artifacts, versions, or pipeline output." value={form.build_evidence} error={errors.build_evidence} rows={4} maxLength={2500} onChange={(value) => updateField("build_evidence", value)} />
          <Field id="test_evidence" label="Test evidence" helper="Test results, pass rates, coverage, or QA sign-off." value={form.test_evidence} error={errors.test_evidence} rows={4} maxLength={2500} onChange={(value) => updateField("test_evidence", value)} />
          <Field id="deployment_evidence" label="Deployment evidence" helper="Staging results, rollout plan, or deployment readiness." value={form.deployment_evidence} error={errors.deployment_evidence} rows={4} maxLength={2500} onChange={(value) => updateField("deployment_evidence", value)} />
          <Field id="known_risks" label="Known risks" helper="Declare risks that need explicit sign-off." value={form.known_risks ?? ""} rows={3} maxLength={2000} optional onChange={(value) => updateField("known_risks", value)} />
          <div className="submit-row">
            <button className="submit-button" type="submit" disabled={busy}>
              {busy ? "Consensus in progress" : "Determine release verdict"}
            </button>
            <p>One write. Refresh-safe recovery. Sender-scoped result.</p>
          </div>
        </form>

        <aside className="lifecycle" aria-labelledby="lifecycle-title">
          <div className="lifecycle-head">
            <p className="section-kicker">Transaction lifecycle</p>
            <h2 id="lifecycle-title">Canonical state</h2>
          </div>
          <div className="status-block" aria-live="polite" aria-atomic="true">
            <span className={`status-state status-${phase}`}>{phase === "idle" ? "ready" : phase}</span>
            <p>{status}</p>
            {hash ? <code>{hash}</code> : null}
            {explorerUrl ? <a className="text-link" href={explorerUrl} target="_blank" rel="noreferrer">Open actual transaction</a> : null}
          </div>
          <ol className="phase-list">
            {PHASES.map((item, index) => {
              const active = item === phase;
              const complete = phase === "complete" || (phaseIndex >= 0 && index < phaseIndex);
              return <li key={item} className={active ? "active" : complete ? "done" : ""}><span>{index + 1}</span><strong>{item}</strong></li>;
            })}
          </ol>
          {error ? <div className="error-box" role="alert"><strong>Action required</strong><p>{error}</p></div> : null}
        </aside>
      </section>

      {result ? <ResultPanel result={result} explorerUrl={explorerUrl} /> : (
        <section className="empty-result" aria-labelledby="empty-title">
          <span aria-hidden="true">RG</span>
          <div><h2 id="empty-title">No canonical verdict yet</h2><p>Complete the evidence intake to create a sender-scoped release record.</p></div>
        </section>
      )}

      <section className="recent" aria-labelledby="recent-title">
        <div className="recent-heading">
          <div><p className="section-kicker">Contract state</p><h2 id="recent-title">Recent gates</h2></div>
          <button className="quiet-button" type="button" onClick={() => void refresh()}>Refresh records</button>
        </div>
        {recent.length ? (
          <div className="results-table" role="region" aria-label="Recent ReleaseGate results" tabIndex={0}>
            <table>
              <thead><tr><th>Verdict</th><th>Request</th><th>Confidence</th><th>Sender</th><th>Recorded</th></tr></thead>
              <tbody>
                {recent.map((record) => (
                  <tr key={`${record.sender}:${record.request_id}`}>
                    <td><span className={`verdict-label verdict-${record.verdict}`}>{VERDICT_LABELS[record.verdict] ?? record.verdict}</span></td>
                    <td><code>{record.request_id}</code></td>
                    <td>{record.confidence}</td>
                    <td><code>{compact(record.sender)}</code></td>
                    <td>{formatTime(record.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty-copy">No records are stored yet. The first completed gate will appear here.</p>}
      </section>

      <footer>
        <p>ReleaseGate stores validator-agreed release verdicts and grounded evidence on GenLayer.</p>
        <span>{adapter.mode === "mock" ? "Simulator data stays in this browser" : `Contract mode on ${adapter.network}`}</span>
      </footer>
    </main>
  );
}
