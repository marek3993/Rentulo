import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <div className="max-w-2xl space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">
            Rent tools locally. Earn from gear you already own.
          </h1>
          <p className="text-white/80">
            Marketplace for short-term rentals of tools and equipment. Built-in reservations, owner
            workflow, admin oversight, reviews, and disputes.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/items"
              className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
            >
              Browse items
            </Link>
            <Link
              href="/items/new"
              className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
            >
              List an item
            </Link>
          </div>

          <div className="text-sm text-white/60">
            Demo: payments disabled · focus on reservations flow
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">Reservations</div>
          <p className="mt-2 text-white/80">
            Date-range booking with overlap protection. Owner confirms/cancels.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">Trust layer</div>
          <p className="mt-2 text-white/80">
            Item + owner ratings. Reviews allowed only after confirmed rental.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">Disputes</div>
          <p className="mt-2 text-white/80">
            Basic dispute workflow for confirmed reservations with owner/admin visibility.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xl font-semibold">Ready to show the demo?</div>
            <div className="mt-1 text-white/80">
              Open Items → choose an item → reserve → manage as owner/admin.
            </div>
          </div>
          <Link
            href="/items"
            className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
          >
            Go to Items
          </Link>
        </div>
      </section>
    </div>
  );
}