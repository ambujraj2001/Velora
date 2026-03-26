export const generateTraceId = (): string => {
  return crypto.randomUUID().replace(/-/g, '');
};
