import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface VideoDetailProps {
  overview: string | null;
  detailedSummary: string | null;
  keyTakeaways: string | null;
}

function Section({
  title,
  content,
}: {
  title: string;
  content: string | null;
}) {
  if (!content) return null;

  return (
    <section
      className="bg-[var(--bg-secondary)] border border-[var(--border-primary)]
                 rounded-xl p-8 transition-colors duration-200"
    >
      <h2
        className="font-[var(--font-heading)] text-xl font-bold
                   text-[var(--fg-primary)] mb-6 pb-4
                   border-b border-[var(--border-primary)]
                   tracking-tight"
      >
        {title}
      </h2>
      <div className="prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </section>
  );
}

export default function VideoDetail({
  overview,
  detailedSummary,
  keyTakeaways,
}: VideoDetailProps) {
  return (
    <div className="flex flex-col gap-8 animate-[fadeIn_500ms_ease-out]">
      <Section title="Overview" content={overview} />
      <Section title="Detailed Summary" content={detailedSummary} />
      <Section title="Key Takeaways" content={keyTakeaways} />
    </div>
  );
}
