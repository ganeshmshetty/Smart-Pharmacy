'use client';
import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import Tesseract from 'tesseract.js';
import { Settings2, ScanLine, CheckCircle, AlertTriangle, RefreshCcw, Camera, Loader2 } from 'lucide-react';
import { getCompartmentsForMedicines } from '@/lib/inventory';

const QrReader = dynamic(() => import('@/components/QrReader'), { ssr: false });

export default function PharmacyCounter() {
  const [scannedData, setScannedData] = useState(null);
  const [requiredCompartments, setRequiredCompartments] = useState([]);
  const [scanError, setScanError] = useState(null);
  const [dispenseStatus, setDispenseStatus] = useState(null);
  const [isDispensing, setIsDispensing] = useState(false);
  const [manualLoading, setManualLoading] = useState(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [ocrStatusMsg, setOcrStatusMsg] = useState(null);
  const fileInputRef = useRef(null);

  const [inputMode, setInputMode] = useState('qr');

  const processPrescriptionData = (parsed) => {
    if (parsed.patient && Array.isArray(parsed.medications) && parsed.medications.length > 0) {
      setScannedData(parsed);
      
      const medicineNames = parsed.medications.map(m => m.medicine);
      const comps = getCompartmentsForMedicines(medicineNames);
      setRequiredCompartments(comps);
      
      setScanError(null);
      setOcrStatusMsg(null);
    } else {
      setScanError("Invalid prescription format.");
    }
  };

  const handleScanSuccess = (decodedText) => {
    try {
      const parsed = JSON.parse(decodedText);
      processPrescriptionData(parsed);
    } catch (e) {
      setScanError("QR code does not contain valid prescription.");
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanProgress(0);
    setOcrStatusMsg({ type: 'info', text: 'Extracting text...' });
    setScanError(null);

    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setScanProgress(Math.round(m.progress * 100));
          }
        }
      });
      
      const extractedText = result.data.text;
      if (!extractedText.trim()) throw new Error("No text found.");

      setOcrStatusMsg({ type: 'info', text: 'Analyzing with AI...' });

      const parseRes = await fetch('/api/parse-prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: extractedText })
      });

      const parsedData = await parseRes.json();
      if (parseRes.ok) {
        processPrescriptionData(parsedData);
      } else {
        setOcrStatusMsg({ type: 'error', text: parsedData.error || 'Parsing failed.' });
      }
    } catch (err) {
      setOcrStatusMsg({ type: 'error', text: err.message || 'Failed to process.' });
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDispense = async () => {
    if (!scannedData || requiredCompartments.length === 0) return;
    setIsDispensing(true);
    setDispenseStatus(null);

    try {
      const results = [];
      for (const comp of requiredCompartments) {
        const res = await fetch('/api/dispense', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ compartment: comp })
        });
        const data = await res.json();
        results.push({ comp, ok: res.ok, data });
        await new Promise(r => setTimeout(r, 500));
      }
      
      const allOk = results.every(r => r.ok);
      if (allOk) {
        setDispenseStatus({ success: true, msg: `Compartments activated: ${requiredCompartments.join(', ')}` });
      } else {
        setDispenseStatus({ success: false, msg: 'Some compartments failed to activate.' });
      }
    } catch (err) {
      setDispenseStatus({ success: false, msg: 'Network error.' });
    } finally {
      setIsDispensing(false);
    }
  };

  const resetScanner = () => {
    setScannedData(null);
    setRequiredCompartments([]);
    setScanError(null);
    setDispenseStatus(null);
    setOcrStatusMsg(null);
  };

  const handleManualAction = async (actionType, compartmentNum = null) => {
    setManualLoading(actionType);
    try {
      const payload = actionType === 'reset' ? { reset: true } : { compartment: compartmentNum };
      const res = await fetch('/api/dispense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) alert(`Error: ${data.error}`);
    } catch (err) {
      alert("Network error.");
    } finally {
      setManualLoading(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 py-4 sm:py-8 px-4 sm:px-0">
      
      {/* Main Scanner Section */}
      <div className="lg:col-span-8 bg-white border border-gray-200 rounded-xl p-5 sm:p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
          <ScanLine className="mr-2 h-5 w-5" />
          Process Prescription
        </h2>

        {!scannedData ? (
          <div className="space-y-6">
            <div className="flex border border-gray-200 rounded-md p-1 bg-gray-50">
              <button
                onClick={() => setInputMode('qr')}
                className={`flex-1 py-2 text-sm font-medium rounded transition-colors ${inputMode === 'qr' ? 'bg-white text-black shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Scan QR Code
              </button>
              <button
                onClick={() => setInputMode('photo')}
                className={`flex-1 py-2 text-sm font-medium rounded transition-colors ${inputMode === 'photo' ? 'bg-white text-black shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Upload Photo (OCR)
              </button>
            </div>

            {inputMode === 'qr' && (
              <div className="space-y-4">
                <div className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 relative min-h-[300px]">
                  <QrReader onScanSuccess={handleScanSuccess} />
                </div>
                {scanError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                    {scanError}
                  </div>
                )}
                <p className="text-gray-500 text-center text-sm">Position patient&apos;s QR code within the frame.</p>
              </div>
            )}

            {inputMode === 'photo' && (
              <div className="space-y-4 border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-12 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                <Camera className="w-8 h-8 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-6 text-sm">Upload a photo of a written prescription to auto-extract details.</p>
                
                <div className="flex justify-center">
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    onChange={handleImageUpload} 
                    ref={fileInputRef}
                    className="hidden" 
                    id="camera-input-pharmacy"
                  />
                  <label 
                    htmlFor="camera-input-pharmacy" 
                    className={`cursor-pointer px-6 py-2.5 bg-black text-white font-medium rounded-md transition-opacity hover:opacity-80 flex items-center text-sm ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Scanning... {scanProgress}%
                      </>
                    ) : (
                      'Choose Photo'
                    )}
                  </label>
                </div>

                {ocrStatusMsg && (
                  <div className={`mt-6 p-4 rounded-md text-left text-sm border ${ocrStatusMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                    {ocrStatusMsg.text}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6 pb-2 border-b border-gray-200">
                Prescription Details
              </h3>
              
              <div className="space-y-6">
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide block mb-1">Patient</span>
                  <span className="font-semibold text-gray-900 text-lg">{scannedData.patient}</span>
                </div>
                
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide block mb-3">Medications</span>
                  <div className="space-y-3">
                    {scannedData.medications.map((med, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-md border border-gray-200 flex justify-between items-center shadow-sm">
                        <span className="font-medium text-gray-900">{med.medicine}</span>
                        <span className="text-gray-500 text-sm">{med.dosage}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <span className="text-gray-500 text-xs uppercase tracking-wide block mb-3">Target Compartments</span>
                  <div className="flex flex-wrap gap-2">
                    {requiredCompartments.map(comp => (
                      <span key={comp} className="px-3 py-1 bg-black text-white text-xs font-bold rounded-full">
                        Compartment {comp}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {dispenseStatus ? (
              <div className={`p-4 rounded-md flex items-center border ${
                !dispenseStatus.success ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
              }`}>
                {!dispenseStatus.success ? <AlertTriangle className="w-5 h-5 mr-3" /> : <CheckCircle className="w-5 h-5 mr-3" />}
                <span className="text-sm font-medium">
                  {dispenseStatus.msg}
                </span>
              </div>
            ) : (
              <button
                onClick={handleDispense}
                disabled={isDispensing}
                className="w-full py-3 bg-black hover:bg-gray-900 disabled:opacity-50 text-white rounded-md font-medium transition-colors flex items-center justify-center text-sm"
              >
                {isDispensing ? 'Processing...' : 'Dispense Medications'}
              </button>
            )}

            <button
              onClick={resetScanner}
              className="w-full py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 rounded-md font-medium transition-colors text-sm"
            >
              Reset Scanner
            </button>
          </div>
        )}
      </div>

      {/* Manual Override Section */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center">
            <Settings2 className="mr-2 h-4 w-4 text-gray-400" />
            Hardware Override
          </h2>
          <p className="text-gray-500 text-xs mb-6">Manually trigger MQTT dispensing events.</p>

          <div className="space-y-3">
            <button
              onClick={() => handleManualAction('c1', 1)}
              disabled={manualLoading !== null}
              className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-md transition-colors disabled:opacity-50 group"
            >
              <span className="font-medium text-sm text-gray-900">Open Compartment 1</span>
              {manualLoading === 'c1' ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" /> : <span className="text-xs text-gray-400 group-hover:text-black transition-colors">Test →</span>}
            </button>

            <button
              onClick={() => handleManualAction('c2', 2)}
              disabled={manualLoading !== null}
              className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-md transition-colors disabled:opacity-50 group"
            >
              <span className="font-medium text-sm text-gray-900">Open Compartment 2</span>
              {manualLoading === 'c2' ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" /> : <span className="text-xs text-gray-400 group-hover:text-black transition-colors">Test →</span>}
            </button>

            <div className="pt-3 mt-3 border-t border-gray-100">
              <button
                onClick={() => handleManualAction('reset')}
                disabled={manualLoading !== null}
                className="w-full flex items-center justify-center p-3 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              >
                {manualLoading === 'reset' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                Lock All Compartments
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
