import "./globals.css";
import AppFooter from "@/components/AppFooter";
import ClientNav from "@/components/ClientNav";
import NotificationToaster from "@/components/NotificationToaster";
import { getThemeInitScript } from "@/lib/theme";

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
    <html lang="sk" suppressHydrationWarning data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="rentulo-app-shell relative flex min-h-screen flex-col overflow-x-clip">
          <ClientNav />
          <main className="relative mx-auto w-full max-w-[1280px] flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8">
            {children}
          </main>
          <AppFooter />
          <NotificationToaster />
        </div>
      </body>
    </html>
  );
}
