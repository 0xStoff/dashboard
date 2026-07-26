const integerPattern = /^-?(?:0|[1-9]\d*)$/;
const decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

const powerOfTen = (exponent) => 10n ** BigInt(exponent);

const assertScale = (scale) => {
    if (!Number.isSafeInteger(scale) || scale < 0 || scale > 255) {
        throw new RangeError("Decimal scale must be an integer between 0 and 255");
    }
};

const parseDecimal = (value) => {
    const normalized = String(value).trim();
    if (!decimalPattern.test(normalized)) {
        throw new TypeError("Amount must be a plain base-10 decimal string");
    }

    const negative = normalized.startsWith("-");
    const unsigned = negative ? normalized.slice(1) : normalized;
    const [whole, fraction = ""] = unsigned.split(".");
    return {
        coefficient: BigInt(`${negative ? "-" : ""}${whole}${fraction}`),
        scale: fraction.length,
    };
};

const formatDecimal = ({ coefficient: initialCoefficient, scale: initialScale }) => {
    let coefficient = initialCoefficient;
    let scale = initialScale;

    while (scale > 0 && coefficient % 10n === 0n) {
        coefficient /= 10n;
        scale -= 1;
    }
    if (coefficient === 0n) return "0";

    const negative = coefficient < 0n;
    const digits = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, "0");
    const splitAt = scale === 0 ? digits.length : digits.length - scale;
    const rendered = scale === 0 ? digits : `${digits.slice(0, splitAt)}.${digits.slice(splitAt)}`;
    return `${negative ? "-" : ""}${rendered}`;
};

const align = (left, right) => {
    const scale = Math.max(left.scale, right.scale);
    return [
        { coefficient: left.coefficient * powerOfTen(scale - left.scale), scale },
        { coefficient: right.coefficient * powerOfTen(scale - right.scale), scale },
    ];
};

export const atomicAmount = (value) => {
    const normalized = typeof value === "bigint" ? value.toString() : String(value).trim();
    if (!integerPattern.test(normalized) || normalized === "-0") {
        throw new TypeError("Atomic amount must be a canonical base-10 integer string");
    }
    return normalized;
};

export const decimalAmount = (value) => formatDecimal(parseDecimal(value));

export const addDecimal = (left, right) => {
    const [a, b] = align(parseDecimal(left), parseDecimal(right));
    return formatDecimal({ coefficient: a.coefficient + b.coefficient, scale: a.scale });
};

export const subtractDecimal = (left, right) => {
    const [a, b] = align(parseDecimal(left), parseDecimal(right));
    return formatDecimal({ coefficient: a.coefficient - b.coefficient, scale: a.scale });
};

export const multiplyDecimal = (left, right) => {
    const a = parseDecimal(left);
    const b = parseDecimal(right);
    return formatDecimal({ coefficient: a.coefficient * b.coefficient, scale: a.scale + b.scale });
};

export const atomicToDecimal = (value, decimals) => {
    assertScale(decimals);
    return formatDecimal({ coefficient: BigInt(atomicAmount(value)), scale: decimals });
};

export const decimalToAtomic = (value, decimals) => {
    assertScale(decimals);
    const parsed = parseDecimal(value);
    if (parsed.scale > decimals) {
        const divisor = powerOfTen(parsed.scale - decimals);
        if (parsed.coefficient % divisor !== 0n) {
            throw new RangeError("Amount cannot be represented exactly at the requested scale");
        }
        return atomicAmount(parsed.coefficient / divisor);
    }
    return atomicAmount(parsed.coefficient * powerOfTen(decimals - parsed.scale));
};
