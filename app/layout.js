import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { DemoProvider } from "@/lib/store";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata = {
  title: "PayProof — Every sale verified by Monnify",
  description:
    "PayProof stops WhatsApp sellers and buyers from relying on fake payment screenshots. Every transfer is confirmed by Monnify and settles only after the buyer confirms delivery.",
};

export const viewport = {
  themeColor: "#EFE6D4",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        <DemoProvider>{children}</DemoProvider>
      </body>
    </html>
  );
}
