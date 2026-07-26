import type { ReactNode } from "react";

export function MetricCard(props: { label: string; value: ReactNode; detail?: ReactNode; tone?: "default" | "warning" }) {
  return (
    <section className={`metric-card${props.tone === "warning" ? " metric-card--warning" : ""}`}>
      <p className="metric-card__label">{props.label}</p>
      <div className="metric-card__value">{props.value}</div>
      {props.detail ? <div className="metric-card__detail">{props.detail}</div> : null}
    </section>
  );
}
