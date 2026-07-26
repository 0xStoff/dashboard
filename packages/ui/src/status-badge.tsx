export function StatusBadge(props: { children: string; tone: "positive" | "warning" | "neutral" | "critical" }) {
  return <span className={`status-badge status-badge--${props.tone}`}>{props.children}</span>;
}
