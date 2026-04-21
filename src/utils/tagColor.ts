// Shared pastel rotation for free-form tags (journal note tags, resident
// interests). Stable across the app — same string → same color everywhere.
// 'prep' is excluded because it's grey and makes chips feel fade.

export const TAG_CHIP_CLASSES = ['memory', 'creative', 'body', 'outing', 'rdv'] as const;
export type TagChipClass = typeof TAG_CHIP_CLASSES[number];

export function tagChipClass(name: string): TagChipClass {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return TAG_CHIP_CLASSES[Math.abs(h) % TAG_CHIP_CLASSES.length];
}
