import Image from "next/image";
import Link from "next/link";
import KeywordBadge from "./KeywordBadge";
import type { VideoListItem } from "@/lib/api";
import styles from "./VideoCard.module.css";

interface VideoCardProps {
    video: VideoListItem;
    index?: number;
}

function formatDuration(seconds: number | null): string {
    if (!seconds) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export default function VideoCard({ video, index = 0 }: VideoCardProps) {
    const delay = `${index * 80}ms`;

    return (
        <Link
            href={`/video/${video.id}`}
            className={styles.card}
            style={{ animationDelay: delay }}
        >
            {/* Thumbnail */}
            <div className={styles.thumbnailWrap}>
                {video.thumbnail_url ? (
                    <Image
                        className={styles.thumbnail}
                        src={video.thumbnail_url}
                        alt={video.title ?? "Video thumbnail"}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                ) : (
                    <div className={styles.thumbnailPlaceholder}>
                        <svg
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            opacity="0.3"
                        >
                            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
                        </svg>
                    </div>
                )}
                {video.duration && (
                    <span className={styles.duration}>{formatDuration(video.duration)}</span>
                )}
                {/* Shimmer overlay */}
                <div className={styles.shimmer} />
            </div>

            {/* Content */}
            <div className={styles.content}>
                <h3 className={styles.title}>{video.title ?? "Untitled"}</h3>

                <div className={styles.meta}>
                    {video.channel_name && (
                        <span className={styles.channel}>{video.channel_name}</span>
                    )}
                    <span className={styles.date}>{formatDate(video.created_at)}</span>
                </div>

                {video.overview && (
                    <p className={styles.overview}>{video.overview}</p>
                )}

                {video.keywords && video.keywords.length > 0 && (
                    <div className={styles.keywords}>
                        {video.keywords.slice(0, 4).map((kw) => (
                            <KeywordBadge key={kw} keyword={kw} />
                        ))}
                        {video.keywords.length > 4 && (
                            <span className={styles.moreKeywords}>
                                +{video.keywords.length - 4}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </Link>
    );
}
