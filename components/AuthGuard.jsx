'use client';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, ArrowRight, LogOut, CheckCircle2, User } from 'lucide-react';

const ROLE_CONFIGS = {
  doctor: { name: 'Doctor', pin: '5678', allowedPaths: ['/doctor', '/'], color: 'bg-black text-white', hoverColor: 'hover:border-black' },
  pharmacy: { name: 'Pharmacist', pin: '1234', allowedPaths: ['/pharmacy', '/'], color: 'bg-black text-white', hoverColor: 'hover:border-black' },
  admin: { name: 'Admin', pin: '0000', allowedPaths: ['/admin', '/doctor', '/pharmacy', '/'], color: 'bg-black text-white', hoverColor: 'hover:border-black' }
};

export default function AuthGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  // Set mounted state
  useEffect(() => {
    setMounted(true);
    const savedUser = localStorage.getItem('smart_pharmacy_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('smart_pharmacy_user');
      }
    }
  }, []);

  // Determine if the current page requires protection
  const isProtectedPath = ['/doctor', '/pharmacy', '/admin'].some(path => pathname === path || pathname.startsWith(path + '/'));

  const handleRoleSelect = (roleKey) => {
    setSelectedRole(roleKey);
    setPinInput('');
    setError(false);
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (!selectedRole) return;

    const config = ROLE_CONFIGS[selectedRole];
    if (pinInput === config.pin) {
      setSuccess(true);
      setError(false);
      setTimeout(() => {
        const userData = { role: selectedRole, name: config.name };
        localStorage.setItem('smart_pharmacy_user', JSON.stringify(userData));
        setUser(userData);
        setSuccess(false);
        setSelectedRole(null);
        setPinInput('');
        
        // Redirect to the role's primary dashboard
        if (selectedRole === 'doctor') router.push('/doctor');
        else if (selectedRole === 'pharmacy') router.push('/pharmacy');
        else if (selectedRole === 'admin') router.push('/admin');
      }, 800);
    } else {
      setError(true);
      setPinInput('');
      // Shake animation effect
      setTimeout(() => setError(false), 500);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('smart_pharmacy_user');
    setUser(null);
    router.push('/');
  };

  const appendPinDigit = (digit) => {
    if (pinInput.length < 4) {
      setPinInput(prev => prev + digit);
    }
  };

  const deleteLastPinDigit = () => {
    setPinInput(prev => prev.slice(0, -1));
  };

  // Prevent flash of unrendered content during server-side render
  if (!mounted) return null;

  // Check if current user is authorized for the current pathname
  let isAuthorized = true;
  if (isProtectedPath) {
    if (!user) {
      isAuthorized = false;
    } else {
      const allowedPaths = ROLE_CONFIGS[user.role]?.allowedPaths || [];
      const hasAccess = allowedPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
      if (!hasAccess) {
        isAuthorized = false;
      }
    }
  }

  // Render Login overlay if not authorized
  if (!isAuthorized) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-50/90 backdrop-blur-md p-4 transition-all duration-300">
        <div className={`w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-6 text-gray-900 transform transition-all ${error ? 'animate-bounce' : ''}`}>
          
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-gray-50 rounded-full text-black mb-3 border border-gray-200">
              <Shield className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">Smart Pharmacy Gateway</h2>
            <p className="text-xs text-gray-500 mt-1">Authorized clinical personnel access only</p>
          </div>

          {/* Mode 1: Select Role */}
          {!selectedRole && (
            <div className="space-y-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Select your workspace:</div>
              <div className="grid gap-3">
                {Object.entries(ROLE_CONFIGS).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => handleRoleSelect(key)}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl transition-all text-left hover:bg-gray-50 group hover:border-black"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center font-bold text-white shadow-sm text-sm">
                        {config.name.substring(0, 3).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{config.name} Portal</div>
                        <div className="text-[10px] text-gray-500">Requires PIN Authorization</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-black transition-colors" />
                  </button>
                ))}
              </div>
              
              {user && (
                <div className="mt-6 pt-4 border-t border-gray-200 text-center">
                  <p className="text-xs text-gray-500 mb-2">Logged in as: <strong className="text-gray-950 font-semibold">{user.name}</strong></p>
                  <button onClick={handleLogout} className="inline-flex items-center text-xs text-red-600 hover:text-red-700 gap-1.5 font-medium transition-colors">
                    <LogOut className="w-3.5 h-3.5" /> Log out of active session
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Enter PIN */}
          {selectedRole && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <button 
                  onClick={() => setSelectedRole(null)} 
                  className="text-xs text-gray-500 hover:text-gray-900 transition-colors font-medium"
                >
                  ← Back to roles
                </button>
              </div>

              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Enter PIN for</div>
                <div className="text-xl font-bold text-gray-900 mt-0.5">{ROLE_CONFIGS[selectedRole].name}</div>
              </div>

              {/* Dots display */}
              <div className="flex justify-center gap-4 my-4">
                {[0, 1, 2, 3].map((index) => (
                  <div 
                    key={index} 
                    className={`w-4 h-4 rounded-full border transition-all ${
                      success 
                        ? 'bg-emerald-500 border-emerald-500 scale-110 shadow-sm'
                        : error
                        ? 'bg-red-500 border-red-500 animate-pulse'
                        : pinInput.length > index
                        ? 'bg-black border-black scale-105 shadow-sm'
                        : 'border-gray-300 bg-gray-50'
                    }`}
                  />
                ))}
              </div>

              {/* Password submission guard */}
              <form onSubmit={handlePinSubmit} className="space-y-4">
                {/* Numeric Keypad */}
                <div className="grid grid-cols-3 gap-3 w-64 mx-auto">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => appendPinDigit(num.toString())}
                      className="w-16 h-16 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-200 rounded-full flex items-center justify-center font-bold text-xl text-gray-900 transition-all shadow-sm"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={deleteLastPinDigit}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => appendPinDigit('0')}
                    className="w-16 h-16 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-200 rounded-full flex items-center justify-center font-bold text-xl text-gray-900 transition-all shadow-sm"
                  >
                    0
                  </button>
                  <button
                    type="submit"
                    className="w-16 h-16 bg-black hover:bg-gray-900 active:bg-black rounded-full flex items-center justify-center font-bold text-white transition-all border border-black shadow-sm"
                  >
                    OK
                  </button>
                </div>

                {error && (
                  <div className="text-red-600 text-center text-sm font-semibold animate-pulse">
                    Access Denied: Invalid passcode PIN
                  </div>
                )}
                {success && (
                  <div className="text-emerald-600 text-center text-sm font-semibold flex items-center justify-center gap-1.5 animate-pulse">
                    <CheckCircle2 className="w-4 h-4" /> Credentials Verified!
                  </div>
                )}
              </form>

              {/* Demo Help Note */}
              <div className="text-[10px] text-gray-400 text-center pt-2 border-t border-gray-200">
                Demo Hint: PIN is <code className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono font-bold border border-gray-200">{ROLE_CONFIGS[selectedRole].pin}</code>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render original application but append a logout trigger in corner
  return (
    <>
      {user && (
        <div className="fixed bottom-4 right-4 z-[90] flex items-center gap-2 bg-white border border-gray-200 text-gray-900 px-4 py-2.5 rounded-full shadow-lg text-xs font-semibold backdrop-blur-sm bg-opacity-90">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <User className="w-3.5 h-3.5 text-gray-500" strokeWidth={2.5} />
          <span className="uppercase tracking-wider text-[10px] text-gray-500">{user.name} Mode</span>
          <button 
            onClick={handleLogout}
            className="ml-2 pl-2 border-l border-gray-200 text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors font-bold"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      )}
      {children}
    </>
  );
}
