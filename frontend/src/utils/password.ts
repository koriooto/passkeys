export type PasswordOptions = {
  length: number;
  includeUpper: boolean;
  includeLower: boolean;
  includeDigits: boolean;
  includeSymbols: boolean;
};

export const generatePassword = (options: PasswordOptions) => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*()-_=+[]{}~";

  const pools: string[] = [];
  if (options.includeUpper) pools.push(upper);
  if (options.includeLower) pools.push(lower);
  if (options.includeDigits) pools.push(digits);
  if (options.includeSymbols) pools.push(symbols);

  if (pools.length === 0 || options.length < pools.length) {
    return "";
  }

  const randomInt = (max: number) => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  };

  const all = pools.join("");
  const result: string[] = [];

  pools.forEach((pool) => {
    result.push(pool[randomInt(pool.length)]);
  });

  while (result.length < options.length) {
    result.push(all[randomInt(all.length)]);
  }

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join("");
};
