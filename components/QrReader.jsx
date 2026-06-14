'use client';
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function QrReader({ onScanSuccess }) {
  const qrRef = useRef(null);
  const scannerRef = useRef(null);
  const isInitializingRef = useRef(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Delay initialization slightly to let Strict Mode finish its double-mount cycle
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady || !qrRef.current) return;

    if (scannerRef.current || isInitializingRef.current) return;
    
    isInitializingRef.current = true;
    scannerRef.current = new Html5Qrcode("qr-reader");

    const startScanner = async () => {
      try {
        await scannerRef.current.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText) => {
            onScanSuccess(decodedText);
            if (scannerRef.current && scannerRef.current.isScanning) {
              scannerRef.current.stop().catch(console.error);
            }
          },
          () => {} // ignore parse errors
        );
      } catch (err) {
        console.error("Error starting scanner", err);
      } finally {
        isInitializingRef.current = false;
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        scannerRef.current = null; // Detach reference immediately
        
        if (scanner.isScanning) {
          scanner.stop().then(() => {
            scanner.clear();
          }).catch((err) => {
            console.error("Failed to stop scanner on unmount", err);
          });
        } else {
          try {
            scanner.clear();
          } catch(e) {}
        }
      }
    };
  }, [onScanSuccess, isReady]);

  return <div id="qr-reader" ref={qrRef} className="w-full"></div>;
}
