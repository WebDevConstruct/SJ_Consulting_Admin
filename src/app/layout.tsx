"use client"
import type { Metadata } from "next";
import {ContextProvider} from "../../Context"
import "./globals.css";

export default function RootLayout({children}:{children:React.ReactNode}) { 
    return(

            <html lang="en">
                <body>
                    <ContextProvider>
                        {children}
                    </ContextProvider>
                </body>
            </html>
        
    )}
