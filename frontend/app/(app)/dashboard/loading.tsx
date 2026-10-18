import { DashboardSkeleton, PageHeadSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return <main className="page dash"><PageHeadSkeleton /><DashboardSkeleton /></main>;
}
