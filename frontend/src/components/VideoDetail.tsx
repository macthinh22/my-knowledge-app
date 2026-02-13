import styles from "./VideoDetail.module.css";

interface VideoDetailProps {
    overview: string | null;
    detailedSummary: string | null;
    keyTakeaways: string | null;
}

/** Minimal markdown → HTML for summary content. */
function renderMarkdown(md: string): string {
    return md
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        // headings
        .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
        .replace(/^### (.+)$/gm, "<h4>$1</h4>")
        .replace(/^## (.+)$/gm, "<h3>$1</h3>")
        .replace(/^# (.+)$/gm, "<h2>$1</h2>")
        // bold
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        // italic
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        // bullet lists (-, •, *)
        .replace(/^[-•*] (.+)$/gm, "<li>$1</li>")
        // numbered lists
        .replace(/^\d+\.\s(.+)$/gm, "<oli>$1</oli>")
        // wrap consecutive <li> in <ul>
        .replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>")
        // wrap consecutive <oli> in <ol>
        .replace(/((?:<oli>.*<\/oli>\n?)+)/g, (match) => {
            return "<ol>" + match.replace(/<\/?oli>/g, (tag) => tag.replace("oli", "li")) + "</ol>";
        })
        // paragraphs (double newline)
        .replace(/\n{2,}/g, "</p><p>")
        // single newlines → <br>
        .replace(/\n/g, "<br>")
        // wrap in <p>
        .replace(/^(.+)$/, "<p>$1</p>")
        // clean up empty <p>
        .replace(/<p>\s*<\/p>/g, "")
        // fix nesting issues
        .replace(/<p><ul>/g, "<ul>")
        .replace(/<\/ul><\/p>/g, "</ul>")
        .replace(/<p><ol>/g, "<ol>")
        .replace(/<\/ol><\/p>/g, "</ol>")
        .replace(/<p><h([234])>/g, "<h$1>")
        .replace(/<\/h([234])><\/p>/g, "</h$1>");
}

function Section({
    title,
    icon,
    content,
}: {
    title: string;
    icon: string;
    content: string | null;
}) {
    if (!content) return null;

    return (
        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>{icon}</span>
                {title}
            </h2>
            <div
                className={`${styles.prose} prose`}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
        </section>
    );
}

export default function VideoDetail({
    overview,
    detailedSummary,
    keyTakeaways,
}: VideoDetailProps) {
    return (
        <div className={styles.wrapper}>
            <Section title="Overview" icon="📋" content={overview} />
            <Section
                title="Detailed Summary"
                icon="📖"
                content={detailedSummary}
            />
            <Section title="Key Takeaways" icon="💡" content={keyTakeaways} />
        </div>
    );
}
