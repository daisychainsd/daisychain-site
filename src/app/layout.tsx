import type { Metadata } from "next";
import {
  Outfit,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  Space_Grotesk,
  Archivo_Black,
  Rubik_Mono_One,
} from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CartProvider } from "@/components/CartProvider";
import CartDrawer from "@/components/CartDrawer";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

// Archivo Black drives every display heading + label on the site.
// Preload so the wordmark + section titles render in black weight
// immediately, instead of swapping after Typekit's 2-step load finishes.
const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const rubikMonoOne = Rubik_Mono_One({
  variable: "--font-rubik-mono-one",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Daisy Chain Records — San Diego",
  description:
    "Independent electronic music label based in San Diego, California.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} ${spaceGrotesk.variable} ${archivoBlack.variable} ${rubikMonoOne.variable} h-full antialiased`}
    >
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/ecz5lqw.css" />
      </head>
      <body className="min-h-full flex flex-col">
        <style>{`
          .site-bg { background-image: url('/bg-dc28-portrait.webp'); }
          @media (min-width: 768px) {
            .site-bg { background-image: url('/bg-dc28-landscape.webp'); }
          }
        `}</style>
        <div
          aria-hidden
          className="site-bg pointer-events-none fixed inset-0 z-0 select-none"
          style={{
            backgroundSize: "cover",
            backgroundPosition: "center center",
            backgroundRepeat: "no-repeat",
            // Lower opacity + brightness/contrast filter so the silk texture
            // reads as a subtle ambient hint rather than competing with content.
            opacity: 0.05,
            filter: "brightness(0.55) contrast(0.85)",
          }}
        />
        <CartProvider>
          <Header />
          <CartDrawer />
          <main className="flex-1 pt-24">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
