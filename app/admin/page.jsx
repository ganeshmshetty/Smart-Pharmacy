'use client';
import { useState, useEffect } from 'react';
import { Activity, Archive, Lock, Unlock, AlertOctagon, Key, EyeOff, Radio, Cpu, History, Search, Pill, Trash2, Plus } from 'lucide-react';
import { useInventory } from '@/hooks/useInventory';

const STATUS_MAP = {
  idle: { label: 'Idle', color: 'gray', icon: Archive },
  open: { label: 'Open', color: 'green', icon: Unlock, text: 'Compartment opened, medicine dispensed' },
  closed: { label: 'Closed', color: 'gray', icon: Lock, text: 'Compartment locked' },
  rfid_required: { label: 'Waiting for RFID', color: 'orange', icon: Key, text: 'Waiting for pharmacist RFID badge', pulse: true },
  rfid_denied: { label: 'RFID Denied', color: 'red', icon: AlertOctagon, text: 'Unauthorized RFID tag scanned' },
  rfid_timeout: { label: 'RFID Timeout', color: 'red', icon: History, text: 'RFID scan timed out, compartment locked' },
  rfid_disabled: { label: 'RFID Disabled', color: 'yellow', icon: EyeOff, text: 'RFID bypassed, opening directly' },
  online: { label: 'Online', color: 'blue', icon: Cpu, text: 'ESP32 shelf came online' },
};

export default function AdminDashboard() {
  const [events, setEvents] = useState([]);
  const [c1Status, setC1Status] = useState({ status: 'idle', ts: new Date().toISOString() });
  const [c2Status, setC2Status] = useState({ status: 'idle', ts: new Date().toISOString() });
  const [now, setNow] = useState(new Date());

  const { inventory, isLoaded, addMedicine, removeMedicine } = useInventory();
  const [newMedName, setNewMedName] = useState('');
  const [newMedComp, setNewMedComp] = useState('1');

  const handleAddMedicine = (e) => {
    e.preventDefault();
    if (newMedName.trim()) {
      addMedicine(newMedName, newMedComp);
      setNewMedName('');
    }
  };

  useEffect(() => {
    const sse = new EventSource('/api/status');
    
    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setEvents((prev) => {
          const newEvents = [data, ...prev].slice(0, 50);
          return newEvents;
        });

        if (data.compartment === 1) setC1Status(data);
        if (data.compartment === 2) setC2Status(data);
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    return () => sse.close();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeAgo = (ts) => {
    const diff = Math.floor((now - new Date(ts)) / 1000);
    if (diff < 2) return 'Just now';
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    return `${Math.floor(diff / 3600)} hours ago`;
  };

  const getStatusUI = (statusString) => {
    return STATUS_MAP[statusString] || { label: statusString, color: 'gray', icon: Activity, text: statusString };
  };

  const StatusCard = ({ num, label, data }) => {
    const ui = getStatusUI(data.status);
    const Icon = ui.icon;
    
    const colorClasses = {
      gray: 'border-gray-200 text-gray-700 bg-gray-50',
      green: 'border-green-200 text-green-700 bg-green-50',
      orange: 'border-orange-200 text-orange-700 bg-orange-50',
      red: 'border-red-200 text-red-700 bg-red-50',
      yellow: 'border-yellow-200 text-yellow-700 bg-yellow-50',
      blue: 'border-blue-200 text-blue-700 bg-blue-50',
    };

    const dotClasses = {
      gray: 'bg-gray-400',
      green: 'bg-green-500',
      orange: 'bg-orange-500',
      red: 'bg-red-500',
      yellow: 'bg-yellow-500',
      blue: 'bg-blue-500',
    };

    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 relative overflow-hidden">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <Archive className="mr-2 h-5 w-5 text-gray-400" />
              Compartment {num}
            </h3>
            <p className="text-gray-500 text-sm mt-1">{label}</p>
          </div>
          <Icon className="w-6 h-6 text-gray-400" />
        </div>
        
        <div className={`p-4 rounded-md border ${colorClasses[ui.color]} flex items-center justify-between`}>
          <div className="flex items-center">
            <div className="relative flex h-2.5 w-2.5 mr-3">
              {ui.pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotClasses[ui.color]} opacity-75`}></span>}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotClasses[ui.color]}`}></span>
            </div>
            <span className="font-semibold text-sm">{ui.label}</span>
          </div>
          <span className="text-xs font-medium text-gray-500">{timeAgo(data.ts)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 py-4 sm:py-8 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Activity className="mr-2 h-6 w-6 text-black" />
          System Dashboard
        </h1>
        <div className="flex items-center px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 font-medium text-xs uppercase tracking-wide w-fit">
          <Radio className="w-3.5 h-3.5 mr-2 animate-pulse text-green-500" />
          Live
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <StatusCard num="1" label="Normal Medications" data={c1Status} />
        <StatusCard num="2" label="Sensitive / Controlled" data={c2Status} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-6 sm:mt-8">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <History className="mr-2 h-5 w-5 text-gray-400" />
            Event Log
          </h2>
          <span className="text-xs font-mono bg-white px-2.5 py-1 rounded-md border border-gray-200 text-gray-500">
            Latest {events.length} events
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium">Compartment</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                    <Search className="w-6 h-6 mx-auto mb-3 opacity-20" />
                    No events recorded yet.
                  </td>
                </tr>
              ) : (
                events.map((ev, i) => {
                  const ui = getStatusUI(ev.status);
                  
                  return (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-gray-500 whitespace-nowrap">
                        {new Date(ev.ts).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 text-sm">
                        {ev.compartment || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-gray-100 border border-gray-200 rounded text-xs font-semibold text-gray-700">
                          {ui.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm">
                        {ui.text || ev.status}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory Management Section */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-6 sm:mt-8">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <Pill className="mr-2 h-5 w-5 text-gray-400" />
            Medicine Inventory
          </h2>
          <span className="text-xs font-mono bg-white px-2.5 py-1 rounded-md border border-gray-200 text-gray-500">
            {isLoaded ? Object.keys(inventory).length : 0} items
          </span>
        </div>
        
        <div className="p-4 sm:p-6">
          <form onSubmit={handleAddMedicine} className="flex flex-col sm:flex-row gap-3 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <input 
              type="text" 
              placeholder="Medicine Name (e.g., Aspirin)" 
              value={newMedName}
              onChange={(e) => setNewMedName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black"
              required
            />
            <select 
              value={newMedComp}
              onChange={(e) => setNewMedComp(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
            >
              <option value="1">Compartment 1 (Normal)</option>
              <option value="2">Compartment 2 (Sensitive)</option>
            </select>
            <button 
              type="submit"
              className="flex items-center justify-center px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-900 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {isLoaded && Object.entries(inventory).map(([med, comp]) => (
              <div key={med} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900 capitalize">{med}</span>
                  <span className="text-xs text-gray-500">Compartment {comp}</span>
                </div>
                <button 
                  onClick={() => removeMedicine(med)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Remove Medicine"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
