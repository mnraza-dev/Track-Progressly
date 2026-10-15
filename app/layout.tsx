import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./studio.css";
import "./charts.css";
import "./product.css";
import { SceneProvider } from "@/components/three/scene-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LearnTrack — Small steps. Extraordinary progress.",
  description:
    "Stop collecting tutorials. Start completing them. A calmer home for your YouTube courses, notes, practice, and learning goals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SceneProvider>{children}</SceneProvider>
      </body>
    </html>
  );
}
