import PODetailClient from "./PODetailClient";

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function PODetailPage({ params }: { params: { id: string } }) {
  return <PODetailClient id={params.id} />;
}
