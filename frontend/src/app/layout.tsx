import type { Metadata } from "next";
import { Source_Serif_4, DM_Sans } from "next/font/google";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "YouTube Knowledge Extractor",
  description:
    "Transform YouTube videos into detailed, structured summaries — learn faster, remember more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${sourceSerif.variable} ${dmSans.variable}`}>
        <header className="fixed top-0 right-0 z-50 p-4">
          <ThemeToggle />
        </header>
        {children}
      </body>
    </html>
  );
}
