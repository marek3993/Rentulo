import type { ReactNode } from "react";
import { OwnerSubnav } from "@/components/owner/OwnerSubnav";

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-white/60">Prenajímateľ</div>
            <h1 className="text-2xl font-semibold">Panel prenajímateľa</h1>
            <p className="mt-1 text-white/60">
              Správa ponúk, rezervácií a reklamácií na jednom mieste.
            </p>
          </div>

          <OwnerSubnav />
        </div>
      </section>

      {children}
    </div>
  );
}
