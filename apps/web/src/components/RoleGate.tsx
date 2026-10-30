"use client";
import Link from "next/link";
import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
// UI convenience only. The REAL protection is the server-side role check on every API route.
export default function RoleGate({ role, children }: { role: string; children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="container empty">Loading…</div>;
  if (!user) return <div className="container empty">Please <Link href="/login"><u>log in</u></Link>.</div>;
  if (user.role !== role) return <div className="container empty">This page is only for {role.toLowerCase()} accounts.</div>;
  return <>{children}</>;
}
