"use client";
import dynamic from "next/dynamic";

const SuperAdminPortal = dynamic(() => import("@/modules/admin/SuperAdminPortal"), { ssr: false });

export default function AdminPage() {
  return <SuperAdminPortal />;
}
