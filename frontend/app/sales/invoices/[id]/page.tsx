import InvoiceDetailClient from "./InvoiceDetailClient";

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  return <InvoiceDetailClient id={params.id} />;
}
