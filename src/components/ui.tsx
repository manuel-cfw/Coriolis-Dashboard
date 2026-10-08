import type { ReactNode } from "react";
import { characterImageUrl } from "../lib/api";

export function Reticle({ className = "reticle" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <line x1="12" y1="2" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" />
      <line x1="12" y1="16" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" />
      <line x1="2" y1="12" x2="8" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="16" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function Wordmark({ style }: { style?: React.CSSProperties }) {
  return (
    <span className="wordmark" style={style} aria-label="Coriolis">
      CORI
      <Reticle />
      LIS
    </span>
  );
}

export function Panel({
  title,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="panel-head">
          {title && <h3 className="heading">{title}</h3>}
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Bar({ kind, current, max }: { kind: "hp" | "mp" | "hull" | "energy"; current: number; max: number }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
  return (
    <div className={`bar ${kind}`} role="meter" aria-valuenow={current} aria-valuemin={0} aria-valuemax={max}>
      <i style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}

export function Dots({ value, max, amber = false }: { value: number; max: number; amber?: boolean }) {
  return (
    <span className={`dots ${amber ? "amber" : ""}`} aria-label={`${value} von ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < value ? "on" : ""} />
      ))}
    </span>
  );
}

export function Portrait({
  character,
  size,
}: {
  character: { id: string; name: string; profile_image_id: string | null };
  size: number;
}) {
  return (
    <img
      className="portrait"
      src={characterImageUrl(character)}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  );
}

export function StatRow({ label, kind, current, max }: { label: string; kind: "hp" | "mp"; current: number; max: number }) {
  return (
    <div className="stat-row">
      <span className="label">{label}</span>
      <Bar kind={kind} current={current} max={max} />
      <span className="num">
        {current}/{max}
      </span>
    </div>
  );
}
