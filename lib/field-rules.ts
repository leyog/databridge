export type FieldRule = {
  required?: boolean;
  regex?: string;
  min?: number;
  max?: number;
  type?: "string" | "number" | "date" | "email";
};

export type FieldRules = Record<string, FieldRule>;

export type ValidationResult = {
  valid: boolean;
  errors: Record<string, string>;
};

export function validateFields(data: Record<string, any>, rules: FieldRules): ValidationResult {
  const errors: Record<string, string> = {};

  for (const [field, rule] of Object.entries(rules)) {
    const val = data[field];
    const isEmpty = val === null || val === undefined || val === "";

    if (rule.required && isEmpty) {
      errors[field] = "This field is required";
      continue;
    }
    if (isEmpty) continue;

    if (rule.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val))) {
      errors[field] = "Invalid email format";
    } else if (rule.type === "number" && isNaN(Number(val))) {
      errors[field] = "Must be a number";
    } else if (rule.type === "date" && isNaN(Date.parse(String(val)))) {
      errors[field] = "Invalid date format";
    }

    if (rule.regex) {
      try {
        if (!new RegExp(rule.regex).test(String(val))) {
          errors[field] = `Does not match required format`;
        }
      } catch { /* invalid regex, skip */ }
    }

    if (rule.min !== undefined) {
      const n = Number(val);
      if (!isNaN(n) && n < rule.min) errors[field] = `Must be at least ${rule.min}`;
      else if (typeof val === "string" && val.length < rule.min) errors[field] = `Must be at least ${rule.min} characters`;
    }

    if (rule.max !== undefined) {
      const n = Number(val);
      if (!isNaN(n) && n > rule.max) errors[field] = `Must be at most ${rule.max}`;
      else if (typeof val === "string" && val.length > rule.max) errors[field] = `Must be at most ${rule.max} characters`;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function buildPromptRules(rules: FieldRules): string {
  const lines: string[] = [];
  for (const [field, rule] of Object.entries(rules)) {
    const constraints: string[] = [];
    if (rule.required) constraints.push("required");
    if (rule.type) constraints.push(`type: ${rule.type}`);
    if (rule.regex) constraints.push(`format: /${rule.regex}/`);
    if (rule.min !== undefined) constraints.push(`min: ${rule.min}`);
    if (rule.max !== undefined) constraints.push(`max: ${rule.max}`);
    if (constraints.length) lines.push(`- ${field}: ${constraints.join(", ")}`);
  }
  return lines.length ? `\nField validation rules:\n${lines.join("\n")}` : "";
}
