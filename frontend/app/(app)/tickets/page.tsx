import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketList } from "@/components/TicketList";

export const metadata: Metadata = { title: "All Tickets" };

export default function TicketsPage() {
  return <Suspense><TicketList mine={false} /></Suspense>;
}
