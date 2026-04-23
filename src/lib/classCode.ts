const CLASS_CODE_KEY = "kinaiya_class_code_v1";

const randomPart = () => Math.random().toString(36).slice(2, 6).toUpperCase();

export const generateClassCode = () => `KIN-${randomPart()}${randomPart()}`;

export const getOrCreateClassCode = () => {
  const existing = localStorage.getItem(CLASS_CODE_KEY);
  if (existing) return existing;
  const code = generateClassCode();
  localStorage.setItem(CLASS_CODE_KEY, code);
  return code;
};

export const rotateClassCode = () => {
  const code = generateClassCode();
  localStorage.setItem(CLASS_CODE_KEY, code);
  return code;
};
