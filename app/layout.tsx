import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./studio.css";
import "./charts.css";
import "./product.css";
import "./chai.css";
import "./rewards.css";
import "./quiz.css";
import { SceneProvider } from "@/components/three/scene-provider";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { TourProvider } from "@/components/tour/tour-context";
import { ProductTour } from "@/components/tour/product-tour";

const bodyFont = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Progressly — Small steps. Extraordinary progress.",
  description:
    "Stop collecting tutorials. Start completing them. A calmer home for your YouTube courses, notes, practice, and learning goals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${bodyFont.variable} ${displayFont.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <SceneProvider>
            <TourProvider>
              {children}
              <ProductTour />
            </TourProvider>
          </SceneProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
