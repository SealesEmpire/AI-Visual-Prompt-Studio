import type { ReactNode } from "react";

export function PageHeading({
  eyebrow,
  title,
  emphasis,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  emphasis: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title} <em>{emphasis}</em></h1><p className="page-subtitle">{description}</p></div>
      {actions}
    </div>
  );
}
