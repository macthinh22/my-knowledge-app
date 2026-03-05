import { redirect } from "next/navigation";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/browse?collection=${encodeURIComponent(id)}`);
}
