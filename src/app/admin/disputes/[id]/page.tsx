"use client";

import { useParams } from "next/navigation";
import DisputeDetailClient from "@/components/disputes/DisputeDetailClient";

export default function AdminDisputeDetailPage() {
  const params = useParams<{ id: string }>();
  return <DisputeDetailClient disputeId={Number(params.id)} viewer="admin" />;
}
