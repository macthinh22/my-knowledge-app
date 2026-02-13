import Link from "next/link";

export default function NotFound() {
    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1rem",
                textAlign: "center",
                padding: "2rem",
            }}
        >
            <span style={{ fontSize: "64px" }}>🔭</span>
            <h1
                style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--text-3xl)",
                    fontWeight: 700,
                    background: "var(--accent-gradient)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                }}
            >
                404
            </h1>
            <p
                style={{
                    fontSize: "var(--text-lg)",
                    color: "var(--fg-secondary)",
                    maxWidth: "400px",
                }}
            >
                The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
            <Link
                href="/"
                style={{
                    marginTop: "0.5rem",
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    color: "var(--accent-cyan)",
                }}
            >
                ← Back to library
            </Link>
        </div>
    );
}
