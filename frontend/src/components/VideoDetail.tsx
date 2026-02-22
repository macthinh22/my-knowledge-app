import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface VideoDetailProps {
  explanation: string | null;
  keyKnowledge: string | null;
  criticalAnalysis: string | null;
  realWorldApplications: string | null;
}

function Section({
  icon,
  title,
  content,
}: {
  icon: string;
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
                   tracking-tight flex items-center gap-2"
      >
        <span>{icon}</span>
        {title}
      </h2>
      <div className="prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </section>
  );
}

export default function VideoDetail({
  explanation,
  keyKnowledge,
  criticalAnalysis,
  realWorldApplications,
}: VideoDetailProps) {
  return (
    <div className="flex flex-col gap-8 animate-[fadeIn_500ms_ease-out]">
      <Section icon="💡" title="Giải thích" content={explanation} />
      <Section icon="🔑" title="Tóm tắt & Kiến thức cốt lõi" content={keyKnowledge} />
      <Section icon="⚖️" title="Phân tích phản biện" content={criticalAnalysis} />
      <Section icon="🌍" title="Ứng dụng thực tế" content={realWorldApplications} />
    </div>
  );
}
