import "./globals.css";
import ClientNav from "@/components/ClientNav";

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
      <body className="min-h-screen bg-neutral-950 text-white">
        <ClientNav />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}