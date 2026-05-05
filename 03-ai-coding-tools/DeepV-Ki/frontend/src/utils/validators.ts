/**
 * Form and input validation utilities
 * Provides consistent validation across the application
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Validators for different input types
 */
export const validators = {
  /**
   * Validate chat/ask question
   */
  question: (input: string): ValidationResult => {
    if (!input) {
      return { valid: false, error: 'Question cannot be empty' };
    }

    const trimmed = input.trim();

    if (trimmed.length === 0) {
      return { valid: false, error: 'Question cannot be empty' };
    }

    if (trimmed.length < 3) {
      return { valid: false, error: 'Question must be at least 3 characters' };
    }

    if (trimmed.length > 2000) {
      return { valid: false, error: 'Question cannot exceed 2000 characters' };
    }

    return { valid: true };
  },

  /**
   * Validate repository URL
   */
  repositoryUrl: (url: string): ValidationResult => {
    if (!url || !url.trim()) {
      return { valid: false, error: 'Repository URL cannot be empty' };
    }

    const trimmed = url.trim();

    // Check if it's a valid URL
    try {
      new URL(trimmed);
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }

    // Check for supported platforms
    const supportedPatterns = [
      /github\.com\//i,
      /gitlab\.com\//i,
      /bitbucket\.org\//i,
      /gitlab\./i,
      /gerrit/i
    ];

    const isSupported = supportedPatterns.some(pattern => pattern.test(trimmed));

    if (!isSupported) {
      return {
        valid: false,
        error: 'Unsupported repository platform. Supported platforms: GitHub, GitLab, Bitbucket, Gerrit'
      };
    }

    return { valid: true };
  },

  /**
   * Validate GitHub/GitLab token
   */
  token: (token: string): ValidationResult => {
    if (!token) {
      return { valid: false, error: 'Token cannot be empty' };
    }

    const trimmed = token.trim();

    if (trimmed.length < 10) {
      return { valid: false, error: 'Token is too short' };
    }

    if (trimmed.length > 1000) {
      return { valid: false, error: 'Token is too long' };
    }

    return { valid: true };
  },

  /**
   * Validate file path for exclusion/inclusion
   */
  filePath: (path: string): ValidationResult => {
    if (!path) {
      return { valid: false, error: 'File path cannot be empty' };
    }

    // Check for invalid characters
    const invalidChars = /[<>:"|?*\x00-\x1f]/g;
    if (invalidChars.test(path)) {
      return { valid: false, error: 'File path contains invalid characters' };
    }

    return { valid: true };
  },

  /**
   * Validate language code (ISO 639-1 format)
   */
  languageCode: (code: string): ValidationResult => {
    if (!code) {
      return { valid: false, error: 'Language code cannot be empty' };
    }

    const languageCodePattern = /^[a-z]{2}(-[A-Z]{2})?$/;
    if (!languageCodePattern.test(code)) {
      return { valid: false, error: 'Invalid language code format (use ISO 639-1)' };
    }

    return { valid: true };
  },

  /**
   * Validate email address
   */
  email: (email: string): ValidationResult => {
    if (!email) {
      return { valid: false, error: 'Email cannot be empty' };
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
      return { valid: false, error: 'Invalid email format' };
    }

    return { valid: true };
  },

  /**
   * Validate username
   */
  username: (username: string): ValidationResult => {
    if (!username) {
      return { valid: false, error: 'Username cannot be empty' };
    }

    const trimmed = username.trim();

    if (trimmed.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters' };
    }

    if (trimmed.length > 50) {
      return { valid: false, error: 'Username cannot exceed 50 characters' };
    }

    const usernamePattern = /^[a-zA-Z0-9_-]+$/;
    if (!usernamePattern.test(trimmed)) {
      return {
        valid: false,
        error: 'Username can only contain letters, numbers, underscores, and hyphens'
      };
    }

    return { valid: true };
  },

  /**
   * Validate JSON string
   */
  json: (jsonString: string): ValidationResult => {
    if (!jsonString) {
      return { valid: false, error: 'JSON cannot be empty' };
    }

    try {
      JSON.parse(jsonString);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },

  /**
   * Validate URL
   */
  url: (url: string): ValidationResult => {
    if (!url || !url.trim()) {
      return { valid: false, error: 'URL cannot be empty' };
    }

    try {
      new URL(url.trim());
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  },

  /**
   * Validate number within range
   */
  numberRange: (
    value: number,
    min?: number,
    max?: number
  ): ValidationResult => {
    if (value === null || value === undefined) {
      return { valid: false, error: 'Number cannot be empty' };
    }

    if (min !== undefined && value < min) {
      return { valid: false, error: `Value must be at least ${min}` };
    }

    if (max !== undefined && value > max) {
      return { valid: false, error: `Value cannot exceed ${max}` };
    }

    return { valid: true };
  },

  /**
   * Validate string length
   */
  stringLength: (
    value: string,
    min?: number,
    max?: number
  ): ValidationResult => {
    if (!value) {
      return { valid: false, error: 'Value cannot be empty' };
    }

    const length = value.trim().length;

    if (min !== undefined && length < min) {
      return { valid: false, error: `Value must be at least ${min} characters` };
    }

    if (max !== undefined && length > max) {
      return { valid: false, error: `Value cannot exceed ${max} characters` };
    }

    return { valid: true };
  },

  /**
   * Validate pattern match
   */
  pattern: (value: string, pattern: RegExp, message?: string): ValidationResult => {
    if (!value) {
      return { valid: false, error: 'Value cannot be empty' };
    }

    if (!pattern.test(value)) {
      return { valid: false, error: message || 'Value does not match required pattern' };
    }

    return { valid: true };
  },

  /**
   * Validate array of values
   */
  array: (
    value: unknown[],
    minLength?: number,
    maxLength?: number
  ): ValidationResult => {
    if (!Array.isArray(value)) {
      return { valid: false, error: 'Value must be an array' };
    }

    if (minLength !== undefined && value.length < minLength) {
      return { valid: false, error: `Array must have at least ${minLength} items` };
    }

    if (maxLength !== undefined && value.length > maxLength) {
      return { valid: false, error: `Array cannot have more than ${maxLength} items` };
    }

    return { valid: true };
  }
};

/**
 * Batch validation - run multiple validators
 */
export const batchValidate = (
  validations: Array<{ field: string; result: ValidationResult }>
): { valid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};

  for (const validation of validations) {
    if (!validation.result.valid && validation.result.error) {
      errors[validation.field] = validation.result.error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Sanitize string input (basic XSS prevention)
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Trim whitespace from string
 */
export const trimInput = (input: string): string => {
  return input.trim();
};

/**
 * Combine validation and sanitization
 */
export const validateAndSanitize = (
  input: string,
  validator: (input: string) => ValidationResult
): { valid: boolean; error?: string; sanitized?: string } => {
  const validation = validator(input);

  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }

  return {
    valid: true,
    sanitized: sanitizeInput(input.trim())
  };
};

export default validators;
