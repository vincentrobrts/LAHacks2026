import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Physics Visualizer",
  description: "Turn physics word problems into interactive projectile simulations."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
