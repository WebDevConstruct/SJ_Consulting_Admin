"use client"
import type { Metadata } from "next";
import {ContextProvider} from "../../Context"
import "./globals.css";
import { StatusToastProvider} from "@/components/ui/status-toast"

export default function RootLayout({children}:{children:React.ReactNode}) { 
    return(

            <html lang="en">
                <body>
                    <ContextProvider>
                        <StatusToastProvider>
                        {children}
                        </StatusToastProvider>
                    </ContextProvider>
                </body>
            </html>
        
    )}
