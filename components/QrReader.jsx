'use client';
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Loader2 } from 'lucide-react';

export default function QrReader({ onScanSuccess }) {
  const containerRef = useRef(null);
  const scannerRef = useRef(null);
  const [status, setStatus] = useState('starting'); // 'starting' | 'scanning' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const scannedRef = useRef(false); // prevent multiple callbacks

  useEffect(() => {
    // unique DOM id required by html5-qrcode
    const elementId = 'qr-reader-stream';
    let scanner = null;

    const start = async () => {
      // Wait for the DOM node to be present
      if (!document.getElementById(elementId)) return;

      try {
        scanner = new Html5Qrcode(elementId, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
          (decodedText) => {
            if (scannedRef.current) return;
            scannedRef.current = true;
            // Stop quietly then fire callback
            scanner.stop().catch(() => {}).finally(() => {
              onScanSuccess(decodedText);
            });
          },
          () => {} // ignore per-frame decode errors
        );

        setStatus('scanning');
      } catch (err) {
        console.error('QR scanner error:', err);
        const msg = err?.message || String(err);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
          setErrorMsg('Camera permission denied. Please allow camera access and reload.');
        } else if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('no camera')) {
          setErrorMsg('No camera found on this device.');
        } else {
          setErrorMsg('Could not start camera. Please reload and try again.');
        }
        setStatus('error');
      }
    };

    // Small delay to survive React Strict Mode double-mount
    const timer = setTimeout(start, 150);

    return () => {
      clearTimeout(timer);
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        if (s.isScanning) {
          s.stop().then(() => s.clear()).catch(() => {});
        } else {
          try { s.clear(); } catch (_) {}
        }
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ minHeight: 300 }}>

      {/* The raw camera feed — html5-qrcode renders the <video> inside this div */}
      <div id="qr-reader-stream" ref={containerRef} className="w-full" />

      {/* Loading overlay */}
      {status === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <p className="text-white text-sm">Starting camera…</p>
        </div>
      )}

      {/* Error overlay */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 px-6 text-center">
          <p className="text-red-400 text-sm font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Scanning viewfinder overlay */}
      {status === 'scanning' && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* Corner brackets */}
          <div className="relative w-[220px] h-[220px]">
            <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-sm" />
            <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-sm" />
            <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-sm" />
            <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-sm" />
            {/* Scanning line */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-green-400 animate-scan-line opacity-80" />
          </div>
        </div>
      )}

    </div>
  );
}
