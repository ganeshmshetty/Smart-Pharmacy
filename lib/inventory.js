export const INVENTORY_DB = {
  // Compartment 1: Normal / Over-the-counter / Standard
  "amoxicillin": 1,
  "ibuprofen": 1,
  "paracetamol": 1,
  "lisinopril": 1,
  "metformin": 1,
  "cetirizine": 1,
  "azithromycin": 1,
  "omeprazole": 1,
  "augmentin": 1,
  "pan-d": 1,
  "hexigel": 1,
  
  // Compartment 2: Sensitive / Controlled / Special Storage
  "adderall": 2,
  "morphine": 2,
  "oxycodone": 2,
  "diazepam": 2,
  "alprazolam": 2,
  "fentanyl": 2,
  "insulin": 2,
  "enzoflam": 2,
};

export function getCompartmentsForMedicines(medicineNames) {
  const compartments = new Set();
  
  for (const med of medicineNames) {
    // Guard: skip null/undefined/empty medicine names (e.g. from a bad AI response)
    if (!med || typeof med !== 'string') {
      compartments.add(1); // default to Compartment 1
      continue;
    }

    const normalizedMed = med.toLowerCase().trim();
    
    // Scan ALL keys and take the highest compartment found.
    // This ensures Compartment 2 (sensitive) always wins over Compartment 1
    // regardless of insertion order in INVENTORY_DB.
    let foundComp = 1; // default to Compartment 1 if no match
    for (const [key, comp] of Object.entries(INVENTORY_DB)) {
      if (normalizedMed.includes(key)) {
        if (comp > foundComp) {
          foundComp = comp;
        }
      }
    }
    compartments.add(foundComp);
  }
  
  return Array.from(compartments).sort();
}
