import clsx from "clsx";
import type { ReactNode } from "react";
import { PRIORITY_LABEL, STATUS_LABEL, type ActionStatus, type Priority } from "@/lib/schema";

export const Logo = ({ light = false }: { light?: boolean }) => (
  <span className="inline-flex items-center gap-2.5">
    <svg viewBox="0 0 40 40" width="32" height="32" aria-hidden="true"><rect width="40" height="40" rx="10" fill={light ? "#ffffff22" : "#1F4E5F"} /><path d="M9 30c7 0 6-9 12-9s6-8 10-8" stroke="#F4EBDD" strokeWidth="3" fill="none" strokeLinecap="round" /><circle cx="31" cy="13" r="3.4" fill="#E0A458" /><circle cx="9" cy="30" r="2.3" fill="#F4EBDD" /></svg>
    <span className={clsx("font-display text-[18px] font-semibold", light ? "text-white" : "text-brand")}>Kinfield <span className="hidden font-body text-[13px] font-bold uppercase tracking-[0.12em] opacity-70 sm:inline">Action Plans</span></span>
  </span>
);

const PCLS: Record<Priority, string> = { now: "bg-now-soft text-now", soon: "bg-soon-soft text-soon", plan_ahead: "bg-ahead-soft text-ahead" };
export const PriorityChip = ({ p }: { p: Priority }) => <span className={clsx("chip", PCLS[p])}>{PRIORITY_LABEL[p]}</span>;

const SCLS: Record<ActionStatus, string> = { not_started: "bg-brand-soft text-brand", in_progress: "bg-soon-soft text-soon", waiting_third_party: "bg-sand text-muted", completed: "bg-ahead-soft text-ahead", no_longer_required: "bg-white text-muted ring-1 ring-line" };
export const StatusChip = ({ s }: { s: ActionStatus }) => <span className={clsx("chip", SCLS[s])}>{STATUS_LABEL[s]}</span>;

export const Card = ({ title, children, actions, className }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) => (
  <section className={clsx("card p-5", className)}>
    {(title || actions) && <div className="mb-3 flex flex-wrap items-center justify-between gap-3">{title && <h2 className="text-[17px]">{title}</h2>}{actions}</div>}
    {children}
  </section>
);

export const Issues = ({ items }: { items: { path: string; message: string }[] }) => (
  <ul role="alert" className="mt-3 space-y-1 rounded-lg border border-now/30 bg-now-soft p-3 text-[13px]">
    {items.slice(0, 12).map((i, n) => <li key={n}><code className="font-mono font-semibold text-now">{i.path || "(root)"}</code> {i.message}</li>)}
    {items.length > 12 && <li className="text-muted">and {items.length - 12} more</li>}
  </ul>
);

export const Meta = ({ items }: { items: [string, ReactNode][] }) => (
  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-4">
    {items.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-muted">{k}</dt><dd className="truncate font-semibold">{v}</dd></div>)}
  </dl>
);
