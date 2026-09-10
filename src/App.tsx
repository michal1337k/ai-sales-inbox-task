import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api } from "./api";
import type { Lead, Message } from "./types";

const path = window.location.pathname.replace(/\/+$/, "") || "/inbox";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function Layout({ children }: { children: ReactNode }) {
  const isPipeline = path === "/pipeline";
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/inbox" aria-label="InboxIQ home"><span className="brand-mark">IQ</span><span>InboxIQ</span></a>
        <nav aria-label="Primary navigation">
          <a className={!isPipeline ? "nav-link active" : "nav-link"} href="/inbox" aria-current={!isPipeline ? "page" : undefined}>Inbox</a>
          <a className={isPipeline ? "nav-link active" : "nav-link"} href="/pipeline" aria-current={isPipeline ? "page" : undefined}>Pipeline</a>
        </nav>
        <span className="status-pill"><span className="status-dot" /> Local workspace</span>
      </header>
      {children}
    </div>
  );
}

function StateMessage({ children }: { children: ReactNode }) {
  return <p className="state-message">{children}</p>;
}

function InboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    api.listMessages().then((result) => {
      if (active) { setMessages(result); setState("ready"); }
    }).catch(() => active && setState("error"));
    return () => { active = false; };
  }, []);

  return (
    <main className="page-container">
      <section className="page-heading"><div><p className="eyebrow">Sales workspace</p><h1>Inbox</h1><p className="muted">Review inbound conversations and decide what deserves a follow-up.</p></div><div className="metric-card"><strong>{messages.length}</strong><span>messages</span></div></section>
      <section className="panel" aria-labelledby="messages-heading">
        <div className="panel-heading"><h2 id="messages-heading">Latest messages</h2><span className="muted">Deterministic demo data</span></div>
        {state === "loading" && <StateMessage>Loading inbox…</StateMessage>}
        {state === "error" && <StateMessage>Could not load the inbox. Check that the API is running.</StateMessage>}
        {state === "ready" && <ul className="message-list">{messages.map((message) => <MessageRow key={message.id} message={message} />)}</ul>}
      </section>
    </main>
  );
}

function MessageRow({ message }: { message: Message }) {
  return (
    <li>
      <a className="message-row" href={`/inbox/${message.id}`}>
        <span className="avatar">{message.senderName.slice(0, 1)}</span>
        <span className="message-copy">
          <span className="message-meta"><strong>{message.senderName}</strong><span>{formatDate(message.createdAt)}</span></span>
          <span className="message-subject">{message.subject}</span>
          <span className="message-preview">{message.company} · {message.body}</span>
        </span>
        <span className="row-arrow" aria-hidden="true">→</span>
      </a>
    </li>
  );
}

function DetailPage({ messageId }: { messageId: string }) {
  const [message, setMessage] = useState<Message | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [form, setForm] = useState({
    product: "",
    quantity: "",
    material: "",
    budget: "",
  });
  const [extractState, setExtractState] = useState<"idle" | "loading" | "error">("idle");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");

  useEffect(() => {
    let active = true;
    api.getMessage(messageId).then((result) => {
      if (active) { setMessage(result); setState("ready"); }
    }).catch(() => active && setState("error"));
    return () => { active = false; };
  }, [messageId]);

  async function handleExtract() {
    setExtractState("loading");

    try {
      const extraction = await api.extractLead(messageId);

      setForm((current) => ({
        product:
          current.product !== ""
            ? current.product
            : extraction.product ?? "",

        quantity:
          current.quantity !== ""
            ? current.quantity
            : extraction.quantity == null
              ? ""
              : String(extraction.quantity),

        material:
          current.material !== ""
            ? current.material
            : extraction.material ?? "",

        budget:
          current.budget !== ""
            ? current.budget
            : extraction.budget == null
              ? ""
              : String(extraction.budget),
      }));

      setExtractState("idle");
    } catch {
      setExtractState("error");
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");

    try {
      await api.createLead({
        sourceMessageId: messageId,
        product: form.product,
        quantity: Number(form.quantity),
        material: form.material === "" ? null : form.material,
        budget: form.budget === "" ? null : Number(form.budget),
      });

      setSaveState("success");
    } catch {
      setSaveState("error");
    }
  }

  if (state === "loading") return <main className="page-container"><StateMessage>Loading message…</StateMessage></main>;
  if (state === "error" || !message) return <main className="page-container"><StateMessage>Message not found.</StateMessage></main>;

  return (
    <main className="page-container detail-layout">
      <a className="back-link" href="/inbox">← Back to inbox</a>
      <section className="detail-grid">
        <article className="panel message-detail">
          <p className="eyebrow">Inbound message</p>
          <h1>{message.subject}</h1>
          <dl className="message-facts">
            <div><dt>Sender</dt><dd>{message.senderName} · {message.senderEmail}</dd></div>
            <div><dt>Company</dt><dd>{message.company}</dd></div>
          </dl>
          <div className="message-body">{message.body}</div>
        </article>
        <aside className="panel" aria-label="Lead extraction">
          <p className="eyebrow">Lead details</p>

          <form onSubmit={handleSave}>
            <div>
              <label htmlFor="product">Product</label>
              <input
                id="product"
                type="text"
                required
                value={form.product}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    product: event.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label htmlFor="quantity">Quantity</label>
              <input
                id="quantity"
                type="number"
                required
                min={1}
                step={1}
                value={form.quantity}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    quantity: event.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label htmlFor="material">Material</label>
              <input
                id="material"
                type="text"
                value={form.material}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    material: event.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label htmlFor="budget">Budget</label>
              <input
                id="budget"
                type="number"
                min={0}
                step="any"
                value={form.budget}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    budget: event.target.value,
                  }))
                }
              />
            </div>
            <button
              type="button"
              onClick={handleExtract}
              disabled={extractState === "loading"}
            >
              {extractState === "loading" ? "Extracting…" : "Extract with AI"}
            </button>

            <button
              type="submit"
              disabled={saveState === "saving"}
            >
              {saveState === "saving" ? "Saving…" : "Save lead"}
            </button>

            {extractState === "error" && (
              <p role="alert">
                Could not extract lead details. You can still fill the form manually.
              </p>
            )}

            {saveState === "error" && (
              <p role="alert">
                Could not save the lead. Check the form and try again.
              </p>
            )}

            {saveState === "success" && (
              <p role="status">
                Lead saved successfully.
              </p>
            )}

          </form>
        </aside>
      </section>
    </main>
  );
}

function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    api.listLeads().then((result) => {
      if (active) { setLeads(result); setState("ready"); }
    }).catch(() => active && setState("error"));
    return () => { active = false; };
  }, []);

  function handleLeadUpdated(updatedLead: Lead) {
    setLeads((current) =>
      current.map((lead) =>
        lead.id === updatedLead.id ? updatedLead : lead
      )
    );
  }

  return (
    <main className="page-container">
      <section className="page-heading"><div><p className="eyebrow">Revenue view</p><h1>Pipeline</h1><p className="muted">Saved leads will appear here.</p></div><div className="metric-card"><strong>{leads.length}</strong><span>leads</span></div></section>
      <section className="panel" aria-labelledby="pipeline-heading">
        <div className="panel-heading"><h2 id="pipeline-heading">Leads</h2></div>
        {state === "loading" && <StateMessage>Loading pipeline…</StateMessage>}
        {state === "error" && <StateMessage>Could not load the pipeline.</StateMessage>}
        {state === "ready" && (leads.length === 0 ? <p className="state-message">No leads yet.</p> : <ul className="lead-list">{leads.map((lead) => <LeadCard key={lead.id} lead={lead} onUpdated={handleLeadUpdated}/>)}</ul>)}
      </section>
    </main>
  );
}

function LeadCard({ lead, onUpdated }: { lead: Lead; onUpdated: (lead: Lead) => void }) {
  const [updateState, setUpdateState] =
    useState<"idle" | "loading" | "error">("idle");

  async function handleMarkAsContacted() {
    setUpdateState("loading");

    try {
      const updatedLead = await api.updateLeadStatus(lead.id);
      onUpdated(updatedLead);
      setUpdateState("idle");
    } catch {
      setUpdateState("error");
    }
  }

  return (
    <li className="lead-card">
      <div>
        <h3>{lead.product}</h3>
        <p>
          {lead.quantity} unit{lead.quantity === 1 ? "" : "s"}
          {lead.material ? ` · ${lead.material}` : ""}
        </p>

        <span className="muted">
          {lead.status} · {lead.budget === null ? "Budget unknown" : `${lead.budget}`}
        </span>

        {lead.status === "NEW" && (
          <button
            type="button"
            onClick={handleMarkAsContacted}
            disabled={updateState === "loading"}
          >
            {updateState === "loading" ? "Updating…" : "Mark as contacted"}
          </button>
        )}

        {updateState === "error" && (
          <p role="alert">
            Could not update the lead status.
          </p>
        )}
      </div>
    </li>
  );
}

export function App() {
  const content = path === "/pipeline" ? <PipelinePage /> : path.startsWith("/inbox/") ? <DetailPage messageId={decodeURIComponent(path.slice("/inbox/".length))} /> : <InboxPage />;
  return <Layout>{content}</Layout>;
}
