import styles from "./KeywordBadge.module.css";

interface KeywordBadgeProps {
    keyword: string;
}

export default function KeywordBadge({ keyword }: KeywordBadgeProps) {
    return <span className={styles.badge}>{keyword}</span>;
}
