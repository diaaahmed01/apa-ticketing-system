import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketListSkeleton } from "@/components/Skeletons";
import { TicketList } from "@/components/TicketList";

export const metadata: Metadata = { title: "My Tickets" };

export default function MyTicketsPage() {
  return <Suspense fallback={<TicketListSkeleton mine />}><TicketList mine /></Suspense>;
}
