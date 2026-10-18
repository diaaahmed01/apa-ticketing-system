import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketListSkeleton } from "@/components/Skeletons";
import { TicketList } from "@/components/TicketList";

export const metadata: Metadata = { title: "All Tickets" };

export default function TicketsPage() {
  return <Suspense fallback={<TicketListSkeleton />}><TicketList mine={false} /></Suspense>;
}
