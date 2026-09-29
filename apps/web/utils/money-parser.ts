export function parseAmountToMinorUnits(amountStr: string): number {
    // Reject anything that isn't a positive number with max 2 decimal places
    const isValidFormat = /^\d+(\.\d{1,2})?$/.test(amountStr);
    
    if (!isValidFormat) {
      throw new Error('Invalid amount: must be a positive number with up to 2 decimal places.');
    }
  
    const parts = amountStr.split('.');
    const major = parseInt(parts[0], 10);
    
    // If there's a decimal part, pad it to ensure "5" becomes "50" (cents/paisas)
    const minorString = parts[1] ? parts[1].padEnd(2, '0') : '00';
    const minor = parseInt(minorString, 10);
  
    return (major * 100) + minor;
  }