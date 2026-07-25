import SupplierDetailClient from "./SupplierDetailClient";

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function SupplierDetailPage({ params }: { params: { id: string } }) {
  return <SupplierDetailClient id={params.id} />;
}
