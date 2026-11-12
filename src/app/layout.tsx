import type { Metadata, Viewport } from "next";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DUWA | دُوّا",
    template: "%s · DUWA",
  },
  description: "عالم صغير، لشخصين فقط. غرفة ألعاب خاصة بكود دعوة — Two players. One private universe.",
  applicationName: "DUWA",
  appleWebApp: {
    capable: true,
    title: "DUWA",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#090B18",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Apply the saved "calm motion" preference before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("duwa:motion")==="off")document.documentElement.dataset.motion="off"}catch(e){}`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <div className="duwa-sky" aria-hidden />
        {children}
      </body>
    </html>
  );
}
