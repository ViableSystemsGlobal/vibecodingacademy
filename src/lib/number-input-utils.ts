/**
 * Utility function to handle number input changes
 * Allows clearing the input (empty string) instead of forcing 0
 * 
 * @param value - The input value (string from input field)
 * @returns The parsed number or empty string if the input is empty
 */
export function parseNumberInput(value: string): number | "" {
  // Allow empty string to clear the field
  if (value === "" || value === null || value === undefined) {
    return "";
  }
  
  // Parse the number
  const parsed = parseFloat(value);
  
  // Return empty string if NaN, otherwise return the parsed number
  return isNaN(parsed) ? "" : parsed;
}

/**
 * Get the display value for a number input
 * Shows empty string for 0 to allow easy clearing
 * 
 * @param value - The number value
 * @returns The value to display in the input (number or empty string)
 */
export function getNumberInputValue(value: number | "" | null | undefined): number | "" {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  // Show empty string for 0 to allow easy clearing
  if (value === 0) {
    return "";
  }
  return value;
}

