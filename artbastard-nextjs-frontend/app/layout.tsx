import type { Metadata } from "next";
import MainLayout from "./components/Layout/MainLayout";
import "./globals.css"; // Keep for basic resets or specific global overrides
import "./styles/theme.scss"; // Import global theme styles

export const metadata: Metadata = {
  title: "ArtBastard NEXT",
  description: "Modernized ArtBastard DMX Controller",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
