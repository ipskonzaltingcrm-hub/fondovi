import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "EU Radar — natječaji i poticaji za JLS",
    template: "%s · EU Radar",
  },
  description:
    "Radar EU i nacionalnih natječaja za jedinice lokalne samouprave — gradove, općine i županije. Praćenje poziva, rokova i prihvatljivosti na jednom mjestu.",
  applicationName: "EU Radar",
};

// Spriječi bljesak pogrešne teme (postavi .dark prije crtanja).
const themeScript = `(function(){try{var t=localStorage.getItem('jlsr-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&m)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="hr"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
