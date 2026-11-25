export function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error("Не задана переменная " + name)
  return value
}

export function numericId(value: string): string {
  if (!/^[1-9]\d*$/.test(value)) throw new Error("Ожидался числовой ID: " + value)
  return value
}

export function packageNames(input: string): string[] {
  const names = input.split(",").map(name => name.trim())
  const valid = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i
  if (names.some(name => !valid.test(name))) {
    throw new Error("Укажите точные npm-имена через запятую, например @angular/core,@company/ui-kit")
  }
  return [...new Set(names)].sort()
}
