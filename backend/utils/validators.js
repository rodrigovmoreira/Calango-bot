// Simulates a simple phone validator for unit testing purposes
export const validatePhone = (phone) => {
  if (!phone) return false;
  // Remove non-digits
  const clean = phone.toString().replace(/\D/g, '');

  // Check length (Brazil: 10 or 11 digits, with area code)
  // DD + 8 or 9 digits
  if (clean.length < 10 || clean.length > 11) return false;

  return true;
};

// Formats to international standard +55...
export const formatToE164 = (phone) => {
  if (!validatePhone(phone)) return null;
  const clean = phone.toString().replace(/\D/g, '');
  return `+55${clean}`;
};
