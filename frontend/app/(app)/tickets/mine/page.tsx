import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketList } from "@/components/TicketList";

export const metadata: Metadata = { title: "My Tickets" };

export default function MyTicketsPage() {
  return <Suspense><TicketList mine /></Suspense>;
}
