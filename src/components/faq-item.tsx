import type { ReactNode } from "react";

export function FaqItem({
  question,
  children,
  defaultOpen = false,
}: {
  question: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="faq-item" open={defaultOpen || undefined}>
      <summary>{question}</summary>
      <div className="faq-answer">{children}</div>
    </details>
  );
}
