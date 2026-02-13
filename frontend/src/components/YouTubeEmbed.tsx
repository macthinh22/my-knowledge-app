import styles from "./YouTubeEmbed.module.css";

interface YouTubeEmbedProps {
    youtubeId: string;
    title?: string;
}

export default function YouTubeEmbed({
    youtubeId,
    title = "YouTube video",
}: YouTubeEmbedProps) {
    return (
        <div className={styles.wrapper}>
            <iframe
                className={styles.iframe}
                src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
            />
        </div>
    );
}
