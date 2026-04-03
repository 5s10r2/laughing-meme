import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { OnboardingStateProvider } from "./context/OnboardingStateContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tarini — RentOK Property Onboarding",
  description: "AI-powered property onboarding specialist",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} antialiased`}
      >
        <OnboardingStateProvider>
          {children}
        </OnboardingStateProvider>
      </body>
    </html>
  );
}
