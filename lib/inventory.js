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
  
  // Compartment 2: Sensitive / Controlled / Special Storage
  "adderall": 2,
  "morphine": 2,
  "oxycodone": 2,
  "diazepam": 2,
  "alprazolam": 2,
  "fentanyl": 2,
  "insulin": 2,
};

export function getCompartmentsForMedicines(medicineNames) {
  const compartments = new Set();
  
  for (const med of medicineNames) {
    const normalizedMed = med.toLowerCase().trim();
    
    // Find if the medicine exists in our DB, if not default to Compartment 1
    let foundComp = 1; 
    for (const [key, comp] of Object.entries(INVENTORY_DB)) {
      if (normalizedMed.includes(key)) {
        foundComp = comp;
        break;
      }
    }
    compartments.add(foundComp);
  }
  
  return Array.from(compartments).sort();
}
