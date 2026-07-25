import SODetailClient from "./SODetailClient";

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function SODetailPage({ params }: { params: { id: string } }) {
  return <SODetailClient id={params.id} />;
}
