import '../styles/globals.css'
import { useEffect } from 'react'
export default function MyApp({ Component, pageProps }){
  useEffect(()=>document.documentElement.classList.add('dark'),[])
  return <Component {...pageProps} />
}
