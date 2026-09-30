export function isValidPaletteName(name: string): boolean {
  return name.length <= 64 && /^\p{L}[\p{L}\p{N}-]*$/u.test(name)
}
