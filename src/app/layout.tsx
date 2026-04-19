import "./globals.css";
import ClientNav from "@/components/ClientNav";
import NotificationToaster from "@/components/NotificationToaster";

export const metadata = {
  title: "Rentulo",
  description: "Peer-to-peer rentals",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sk">
      <body className="min-h-screen bg-neutral-950 text-white antialiased">
        <div className="relative min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.08),transparent_24%),linear-gradient(180deg,#09090b_0%,#0b0c10_100%)]">
          <ClientNav />
          <main className="relative mx-auto max-w-[1280px] px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8">
            {children}
          </main>
          <NotificationToaster />
        </div>
      </body>
    </html>
  );
}
