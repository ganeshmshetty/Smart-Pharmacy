'use client';
import { useState, useEffect, useCallback } from 'react';
import { INVENTORY_DB as DEFAULT_INVENTORY } from '@/lib/inventory';

export function useInventory() {
  const [inventory, setInventory] = useState(DEFAULT_INVENTORY);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem('smart_pharmacy_inventory');
    if (stored) {
      try {
        setInventory(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse stored inventory", e);
      }
    } else {
      // Initialize if empty
      localStorage.setItem('smart_pharmacy_inventory', JSON.stringify(DEFAULT_INVENTORY));
    }
    setIsLoaded(true);
  }, []);

  const addMedicine = useCallback((name, compartment) => {
    setInventory(prev => {
      const normalizedName = name.toLowerCase().trim();
      if (!normalizedName) return prev;
      
      const newInventory = { ...prev, [normalizedName]: parseInt(compartment) };
      localStorage.setItem('smart_pharmacy_inventory', JSON.stringify(newInventory));
      return newInventory;
    });
  }, []);

  const removeMedicine = useCallback((name) => {
    setInventory(prev => {
      const newInventory = { ...prev };
      delete newInventory[name];
      localStorage.setItem('smart_pharmacy_inventory', JSON.stringify(newInventory));
      return newInventory;
    });
  }, []);

  const getCompartmentsForMedicines = useCallback((medicineNames) => {
    const compartments = new Set();
    
    for (const med of medicineNames) {
      if (!med || typeof med !== 'string') {
        compartments.add(1); // default to Compartment 1
        continue;
      }

      const normalizedMed = med.toLowerCase().trim();
      let foundComp = 1; // default
      
      for (const [key, comp] of Object.entries(inventory)) {
        if (normalizedMed.includes(key)) {
          if (comp > foundComp) {
            foundComp = comp;
          }
        }
      }
      compartments.add(foundComp);
    }
    
    return Array.from(compartments).sort();
  }, [inventory]);

  return {
    inventory,
    isLoaded,
    addMedicine,
    removeMedicine,
    getCompartmentsForMedicines
  };
}
