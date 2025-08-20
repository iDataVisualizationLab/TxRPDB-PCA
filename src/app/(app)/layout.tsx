import type React from "react"
import "@/app/globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import Header from "@/components/nav/header"
import HeaderMobile from "@/components/nav/header-mobile"
import MarginWidthWrapper from "@/components/margin-width-wrapper"
import PageWrapper from "@/components/page-wrapper"
import SideNav from "@/components/nav/side-nav"
import { SectionProvider } from "@/context/SectionContext"
import { ThemeProvider } from "@/context/ThemeContext"
import { MapProvider } from "@/context/MapContext"
import { GlobalLoadingProvider } from "@/context/GlobalLoadingContext"
import GlobalContentLoader from "@/components/global-content-loader"
import ProtectedLayout from "@/app/(app)/ProtectedLayout";
import { ModalProvider } from '@/context/ModalContext';

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "TxRPDB",
  description: "Texas Rigid Pavement Database (TxRPDB)",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`bg-white ${inter.className}`}>
        <ProtectedLayout><ThemeProvider>
          <MapProvider>
            <GlobalLoadingProvider>
              {/* Add the GlobalContentLoader here */}
              <GlobalContentLoader />
              <div className="flex">
                <SideNav />
                <main className="flex-1">
                  <MarginWidthWrapper>
                    <Header />
                    <HeaderMobile />
                    <PageWrapper>
                      <SectionProvider>
                        <ModalProvider>
                          {children}
                        </ModalProvider>
                      </SectionProvider>
                    </PageWrapper>
                  </MarginWidthWrapper>
                </main>
              </div>
            </GlobalLoadingProvider>
          </MapProvider>
        </ThemeProvider>
        </ProtectedLayout>

      </body>
    </html>
  )
}
