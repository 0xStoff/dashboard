export const toFixedString = (item: unknown, digits = 2) => {
  const num = Number(item);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("de-CH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

type NumberFormat = "amount" | "price" | "axis" | "percentage";

const formatLocaleNumber = (value: number, maximumFractionDigits: number, minimumFractionDigits = 0) =>
  value.toLocaleString("de-CH", {
    minimumFractionDigits,
    maximumFractionDigits,
  });

export const formatNumber = (value: number, type: NumberFormat) => {
  const absoluteValue = Math.abs(value);
  switch (type) {
    case "amount":
      if (absoluteValue >= 100) return toFixedString(value, 0);
      if (absoluteValue >= 0.1) return toFixedString(value);
      return toFixedString(value, 6);
    case "price":
      if (absoluteValue >= 100) return toFixedString(value, 0);
      if (absoluteValue >= 0.1) return toFixedString(value);
      if (absoluteValue >= 0.01) return formatLocaleNumber(value, 4);
      if (absoluteValue >= 0.0001) return formatLocaleNumber(value, 6);
      if (absoluteValue >= 0.000001) return formatLocaleNumber(value, 8);
      if (absoluteValue === 0) return "0";
      return value.toExponential(2);
    case "axis":
      if (absoluteValue >= 1000000) return toFixedString(value / 1000000, 0) + " m";
      if (absoluteValue >= 10000) return toFixedString(value / 1000, 0) + " k";
      if (absoluteValue >= 100) return toFixedString(value, 0);
      if (absoluteValue >= 0.1) return toFixedString(value);
      return toFixedString(value, 0);
    case "percentage":
      return toFixedString(value) + " %";
    default:
      return value;
  }
};
// tickFormatter={(value) => `$ ${toFixedString(value / 1000, 0)}k`}
