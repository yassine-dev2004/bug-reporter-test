import { useEffect, useState } from 'react'
import type { AppProps } from 'next/app'
import Script from 'next/script'
import '../styles/globals.css'

declare module 'react' {
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

      {/* Bug Reporter Widget Script loaded dynamically or locally served */}
      <Script
        src={process.env.NEXT_PUBLIC_BUG_REPORTER_SCRIPT_URL || '/bug-reporter-widget.js'}
        strategy="afterInteractive"
      />

      {/* Render the widget on the client side only after mount to prevent hydration issues */}
      {isMounted && (
        <bug-reporter-widget
          project-key={process.env.NEXT_PUBLIC_BUG_REPORTER_KEY || 'local-demo-key'}
          api-base={process.env.NEXT_PUBLIC_BUG_REPORTER_API_URL || 'http://localhost:8081'}
          position="bottom-right"
        />
      )}
    </>
  )
}


