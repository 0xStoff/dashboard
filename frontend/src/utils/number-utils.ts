export const toFixedString = (item: number | string, digits = 2) => {
  const num = parseFloat(item.toString());
  return num.toLocaleString("de-CH", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export const formatNumber = (value, type) => {
  switch (type) {
    case "amount":
    case "price":
      if (value >= 100) return toFixedString(value, 0);
      if (value >= 0.1) return toFixedString(value);
      return toFixedString(value, 6);
    // case "price":
    //   return value >= 0.1 ? toFixedString(value) : toFixedString(value, 6);
    case "percentage":
      return toFixedString(value) + " %";
    default:
      return value;
  }
};