export function isOasisOperatingDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day >= 2 && day <= 5;
}
