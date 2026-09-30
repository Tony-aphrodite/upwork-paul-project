import clsx from "clsx";

export const Logo = ({ light = false }: { light?: boolean }) => (
  <span className="inline-flex items-center gap-2.5">
    <svg viewBox="0 0 40 40" width="32" height="32" aria-hidden="true"><rect width="40" height="40" rx="10" fill={light ? "#ffffff22" : "#1F4E5F"} /><path d="M9 30c7 0 6-9 12-9s6-8 10-8" stroke="#F4EBDD" strokeWidth="3" fill="none" strokeLinecap="round" /><circle cx="31" cy="13" r="3.4" fill="#E0A458" /><circle cx="9" cy="30" r="2.3" fill="#F4EBDD" /></svg>
    <span className={clsx("font-display text-[18px] font-semibold", light ? "text-white" : "text-brand")}>Ageing Navigator</span>
  </span>
);
