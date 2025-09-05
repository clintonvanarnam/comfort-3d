"use client"

import { useEffect } from 'react'

export default function SetVh() {
  useEffect(() => {
    const setVh = () => {
      // 1% of the viewport height
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }

    setVh()
    window.addEventListener('resize', setVh, { passive: true })
    if (window.visualViewport) window.visualViewport.addEventListener('resize', setVh)

    return () => {
      window.removeEventListener('resize', setVh)
      if (window.visualViewport) window.visualViewport.removeEventListener('resize', setVh)
    }
  }, [])

  return null
}
