import { useEffect, useState } from 'react'
import type { AppProps } from 'next/app'
import Script from 'next/script'
import '../styles/globals.css'

// Declare custom element for TypeScript compatibility
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'bug-reporter-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'project-key'?: string;
        'api-base'?: string;
        'position'?: string;
      };
    }
  }
}

export default function App({ Component, pageProps }: AppProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  return (
    <>
      <Component {...pageProps} />

      {/* Bug Reporter Widget Script loaded asynchronously without blocking */}
      <Script
        src="https://YOUR_RAILWAY_APP_URL/widget.js"
        strategy="afterInteractive"
      />

      {/* Render the widget on the client side only after mount to prevent hydration issues */}
      {isMounted && (
        <bug-reporter-widget
          project-key="YOUR_PROJECT_KEY"
          api-base="https://YOUR_RAILWAY_APP_URL"
          position="bottom-right"
        />
      )}
    </>
  )
}

