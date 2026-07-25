import JobDetailClient from "./JobDetailClient";

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
  return <JobDetailClient id={params.id} />;
}
