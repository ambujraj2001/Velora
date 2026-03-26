const FULL_TEMPLATE = /^\{\{([\w-]+)\.([\w.]+)\}\}$/;
const INLINE_TEMPLATE = /\{\{([\w-]+)\.([\w.]+)\}\}/g;

export function resolveInputs(
  input: Record<string, any>,
  previousResults: Record<string, any>,
): Record<string, any> {
  return resolveValue(JSON.parse(JSON.stringify(input)), previousResults) as Record<string, any>;
}

function resolveValue(value: any, results: Record<string, any>): any {
  if (typeof value === 'string') {
    return resolveString(value, results);
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveValue(v, results));
  }
  if (typeof value === 'object' && value !== null) {
    const resolved: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = resolveValue(v, results);
    }
    return resolved;
  }
  return value;
}

function resolveString(str: string, results: Record<string, any>): any {
  const fullMatch = str.match(FULL_TEMPLATE);
  if (fullMatch) {
    return getNestedValue(results, fullMatch[1], fullMatch[2]);
  }

  return str.replace(INLINE_TEMPLATE, (_match, stepId, path) => {
    const val = getNestedValue(results, stepId, path);
    return typeof val === 'string' ? val : JSON.stringify(val);
  });
}

function getNestedValue(
  results: Record<string, any>,
  stepId: string,
  path: string,
): any {
  const stepResult = results[stepId];
  if (stepResult === undefined) {
    throw new Error(`Unresolved reference: step "${stepId}" not found in results`);
  }

  let current = stepResult;
  for (const part of path.split('.')) {
    if (current == null) {
      throw new Error(`Unresolved reference: {{${stepId}.${path}}}`);
    }
    current = current[part];
  }

  if (current === undefined) {
    throw new Error(`Unresolved reference: {{${stepId}.${path}}}`);
  }

  return current;
}
