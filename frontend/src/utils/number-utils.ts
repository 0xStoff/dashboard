export const toFixedString = (item: number | string, digits = 2) => {
  const num = parseFloat(item.toString());
  return Math.abs(num).toLocaleString("de-CH", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export const formatNumber = (value, type) => {
  switch (type) {
    case "amount":
    case "price":
      if (value >= 100) return toFixedString(value, 0);
      if (value >= 0.1) return toFixedString(value);
      return toFixedString(value, 6);
    case "axis":
      if (value >= 1000000) return toFixedString(value / 1000000, 0) + " m";
      if (value >= 10000) return toFixedString(value / 1000, 0) + " k";
      if (value >= 100) return toFixedString(value, 0);
      if (value >= 0.1) return toFixedString(value);
      return toFixedString(value, 0);
    case "percentage":
      return toFixedString(value) + " %";
    default:
      return value;
  }
};
// tickFormatter={(value) => `$ ${toFixedString(value / 1000, 0)}k`}
