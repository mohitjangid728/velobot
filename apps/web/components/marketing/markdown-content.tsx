import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders admin-authored markdown (legal pages) to React elements — no raw HTML support, so this stays safe even though the content is always admin-authored, not user-submitted. Styled by the parent's `[&_h2]:...` etc. selectors (see LegalPageShell), plus its own table styling since none of the existing legal pages had a table until now. */
export function MarkdownContent({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children }) => (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">{children}</thead>,
        th: ({ children }) => <th className="px-4 py-2.5 font-medium">{children}</th>,
        tbody: ({ children }) => <tbody className="divide-y">{children}</tbody>,
        td: ({ children }) => <td className="px-4 py-3 text-muted-foreground">{children}</td>,
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
