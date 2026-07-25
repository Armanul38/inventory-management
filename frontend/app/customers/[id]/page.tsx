import CustomerDetailClient from "./CustomerDetailClient";

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  return <CustomerDetailClient id={params.id} />;
}
