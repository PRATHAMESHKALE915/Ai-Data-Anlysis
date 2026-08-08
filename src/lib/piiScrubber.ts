export interface PiiRuleOptions {
  email: boolean;
  phone: boolean;
  creditCard: boolean;
  ipAddress: boolean;
  ssn: boolean;
  names: boolean;
}

export interface PiiScanResult {
  scrubbedText: string;
  counts: {
    email: number;
    phone: number;
    creditCard: number;
    ipAddress: number;
    ssn: number;
    names: number;
  };
  totalDetections: number;
}

// Common RegEx patterns for PII
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const CREDIT_CARD_REGEX = /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g;
const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;
// Basic common full name pattern heuristics
const COMMON_NAMES_REGEX = /\b(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)?\s*([A-Z][a-z]{2,15}\s+[A-Z][a-z]{2,15})\b/g;

export function scrubPiiText(text: string, options: PiiRuleOptions): PiiScanResult {
  if (!text) {
    return {
      scrubbedText: '',
      counts: { email: 0, phone: 0, creditCard: 0, ipAddress: 0, ssn: 0, names: 0 },
      totalDetections: 0,
    };
  }

  let result = text;
  const counts = {
    email: 0,
    phone: 0,
    creditCard: 0,
    ipAddress: 0,
    ssn: 0,
    names: 0,
  };

  if (options.creditCard) {
    const matches = result.match(CREDIT_CARD_REGEX);
    if (matches) {
      counts.creditCard = matches.length;
      result = result.replace(CREDIT_CARD_REGEX, '[CARD_REDACTED]');
    }
  }

  if (options.email) {
    const matches = result.match(EMAIL_REGEX);
    if (matches) {
      counts.email = matches.length;
      result = result.replace(EMAIL_REGEX, '[EMAIL_REDACTED]');
    }
  }

  if (options.ssn) {
    const matches = result.match(SSN_REGEX);
    if (matches) {
      counts.ssn = matches.length;
      result = result.replace(SSN_REGEX, '[SSN_REDACTED]');
    }
  }

  if (options.phone) {
    const matches = result.match(PHONE_REGEX);
    if (matches) {
      // avoid replacing numbers that are clearly part of dates or short IDs
      counts.phone = matches.length;
      result = result.replace(PHONE_REGEX, '[PHONE_REDACTED]');
    }
  }

  if (options.ipAddress) {
    const matches = result.match(IP_REGEX);
    if (matches) {
      counts.ipAddress = matches.length;
      result = result.replace(IP_REGEX, '[IP_REDACTED]');
    }
  }

  if (options.names) {
    const matches = result.match(COMMON_NAMES_REGEX);
    if (matches) {
      counts.names = matches.length;
      result = result.replace(COMMON_NAMES_REGEX, '$1 [NAME_REDACTED]');
    }
  }

  const totalDetections = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    scrubbedText: result,
    counts,
    totalDetections,
  };
}
