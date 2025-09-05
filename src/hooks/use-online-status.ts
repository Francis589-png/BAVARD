
"use client";

import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const getInitialStatus = () => {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
      return window.navigator.onLine;
    }
    return true; // Default to online on the server
  };
  
  const [isOnline, setIsOnline] = useState(getInitialStatus);

  useEffect(() => {
    // This check is to ensure this effect only runs on the client
    if (typeof window === 'undefined') {
      return;
    }

    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
