'use client';
import { useState } from 'react';
import QRCode from 'qrcode';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';

export default function DoctorPortal() {
  const [patient, setPatient] = useState('');
  const [medications, setMedications] = useState([{ medicine: '', dosage: '' }]);
  
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [prescription, setPrescription] = useState(null);

  const handleAddMedicine = () => {
    setMedications([...medications, { medicine: '', dosage: '' }]);
  };

  const handleRemoveMedicine = (index) => {
    const newMeds = medications.filter((_, i) => i !== index);
    setMedications(newMeds);
  };

  const handleMedicationChange = (index, field, value) => {
    const newMeds = [...medications];
    newMeds[index][field] = value;
    setMedications(newMeds);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    
    if (!patient.trim()) {
      alert("Please enter patient name.");
      return;
    }

    const validMeds = medications.filter(m => m.medicine.trim() && m.dosage.trim());
    if (validMeds.length === 0) {
      alert("Please add at least one medicine with dosage.");
      return;
    }

    const pres = {
      patient: patient.trim(),
      medications: validMeds,
      issued_at: new Date().toISOString()
    };

    setPrescription(pres);

    try {
      const url = await QRCode.toDataURL(JSON.stringify(pres), {
        margin: 2,
        width: 300,
        color: { dark: '#000000', light: '#ffffff' }
      });
      setQrCodeUrl(url);
    } catch (err) {
      console.error(err);
      alert("Error generating QR code.");
    }
  };

  const resetForm = () => {
    setPatient('');
    setMedications([{ medicine: '', dosage: '' }]);
    setQrCodeUrl('');
    setPrescription(null);
  };

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-8 px-4 sm:px-0">
      {!prescription ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">New Prescription</h1>
            <p className="text-gray-500 text-sm mt-1">Enter patient details and required medications.</p>
          </div>

          <form onSubmit={handleGenerate} className="space-y-8">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Patient Name</label>
              <input
                type="text"
                value={patient}
                onChange={(e) => setPatient(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-shadow text-sm"
                placeholder="e.g. Jane Doe"
              />
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-900">Medications</label>
              </div>

              {medications.map((med, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex-1 space-y-3">
                    <input
                      type="text"
                      value={med.medicine}
                      onChange={(e) => handleMedicationChange(index, 'medicine', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-shadow text-sm"
                      placeholder="Medicine (e.g. Amoxicillin)"
                    />
                    <input
                      type="text"
                      value={med.dosage}
                      onChange={(e) => handleMedicationChange(index, 'dosage', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-shadow text-sm"
                      placeholder="Dosage (e.g. 500mg twice daily)"
                    />
                  </div>
                  {medications.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMedicine(index)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors mt-1"
                      title="Remove"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddMedicine}
                className="text-sm font-medium text-black flex items-center hover:opacity-70 transition-opacity"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Medicine
              </button>
            </div>
            
            <div className="pt-4 border-t border-gray-100">
              <button
                type="submit"
                className="w-full py-3 bg-black hover:bg-gray-900 text-white font-medium rounded-md transition-colors"
              >
                Generate QR Code
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-8 max-w-md mx-auto text-center">
          <div className="mb-6">
            <h2 className="text-xl font-bold tracking-tight text-gray-900">Prescription Ready</h2>
            <p className="text-gray-500 text-sm mt-1">Scan at the Pharmacy Counter</p>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 inline-block bg-white mb-6">
            <img src={qrCodeUrl} alt="Prescription QR" className="w-48 h-48 mx-auto" />
          </div>
          
          <div className="text-left bg-gray-50 p-4 rounded-md border border-gray-200 mb-8">
            <p className="text-sm text-gray-500 mb-1">Patient</p>
            <p className="font-semibold text-gray-900 mb-4">{prescription.patient}</p>
            
            <p className="text-sm text-gray-500 mb-1">Medications</p>
            <ul className="space-y-2">
              {prescription.medications.map((med, idx) => (
                <li key={idx} className="flex justify-between items-start text-sm">
                  <span className="font-medium text-gray-900">{med.medicine}</span>
                  <span className="text-gray-600 text-right ml-4">{med.dosage}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={resetForm}
            className="w-full py-3 border border-gray-300 hover:bg-gray-50 text-gray-900 font-medium rounded-md transition-colors flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Write Another
          </button>
        </div>
      )}
    </div>
  );
}
