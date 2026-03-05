import { redirect } from "next/navigation";

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  let normalizedTag = tag;

  try {
    normalizedTag = decodeURIComponent(tag);
  } catch {}

  redirect(`/browse?tag=${encodeURIComponent(normalizedTag)}`);
}
