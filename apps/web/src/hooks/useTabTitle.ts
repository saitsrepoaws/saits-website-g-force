/**
 * useTabTitle Hook
 * 
 * Sets browser tab title with Tab ID for easy multi-tab identification
 * Each tab shows: [Icon] [Page Name] [Short Tab ID]
 * 
 * Example: 🎵 Player [x7k9m2p]
 */

import { useEffect } from 'react'
import { getTabId } from '../services/pubsub'

export function useTabTitle(pageTitle: string, icon: string = '📱') {
  useEffect(() => {
    const tabId = getTabId()
    const shortId = tabId.substring(4, 11) // Extract readable part
    const fullTitle = `${icon} ${pageTitle} [${shortId}]`
    
    document.title = fullTitle
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🆔 TAB IDENTIFICATION')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Page:', pageTitle)
    console.log('Full Tab ID:', tabId)
    console.log('Short ID:', shortId)
    console.log('Browser Title:', fullTitle)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    return () => {
      document.title = 'G-Forge IoT' // Reset on unmount
    }
  }, [pageTitle, icon])
}

export default useTabTitle
