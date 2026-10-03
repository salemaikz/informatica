import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Markdown для теории, конспектов и ответов ИИ. Сырые HTML-теги не рендерятся (безопасно). */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={clsx("prose-app", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
