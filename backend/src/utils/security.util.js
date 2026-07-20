/**
 * Validates password complexity strength.
 * Enforces: At least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special symbol.
 * 
 * @param {string} password - Raw user password
 * @returns {boolean} True if complexity satisfies criteria
 */
export function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return false;
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  return hasUpper && hasLower && hasNumber && hasSpecial;
}

export default {
  validatePasswordStrength,
};
