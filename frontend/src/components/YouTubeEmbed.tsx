interface YouTubeEmbedProps {
  youtubeId: string;
  title?: string;
}

export default function YouTubeEmbed({
  youtubeId,
  title = "YouTube video",
}: YouTubeEmbedProps) {
  return (
    <div
      className="relative w-full aspect-video rounded-xl overflow-hidden
                 bg-[var(--bg-tertiary)] shadow-[var(--shadow-md)]
                 border border-[var(--border-primary)]
                 animate-[slideUp_500ms_ease-out]"
    >
      <iframe
        className="absolute inset-0 w-full h-full border-none"
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
