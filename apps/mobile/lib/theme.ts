export const C = { brand: "#0f766e", accent: "#f59e0b", ink: "#1c1917", muted: "#57534e", line: "#e7e5e4", bg: "#fafaf9", card: "#ffffff", danger: "#b91c1c", ok: "#15803d" };
export const rupees = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
