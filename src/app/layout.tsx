import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Takenlijstje", template: "%s · Takenlijstje" },
  description: "Huishoudelijke taken eenvoudig plannen, verdelen en afvinken.",
  applicationName: "Takenlijstje",
  appleWebApp: { capable: true, title: "Takenlijstje", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1d27" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <body className="min-h-dvh">
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ classNames: { toast: "rounded-2xl" } }}
          offset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
          mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
        />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
