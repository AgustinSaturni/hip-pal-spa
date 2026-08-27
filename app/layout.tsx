import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hip-Pal",
  description: "Sistema de análisis de tomografías de cadera",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen flex">
          <Sidebar />
          <div className="flex-1 flex flex-col ml-64">
            <Topbar />
            <main className="flex-1 bg-gray-50 p-6 mt-16">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
