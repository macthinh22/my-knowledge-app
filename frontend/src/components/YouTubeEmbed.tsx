interface YouTubeEmbedProps {
  youtubeId: string;
  title: string;
}

export function YouTubeEmbed({ youtubeId, title }: YouTubeEmbedProps) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        className="h-full w-full"
      />
    </div>
  );
}
