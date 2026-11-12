export function evaluateQuickExpression(source: string): number {
  const input = source.replace(/[\s\u00a0\u202f]/g, "").replace(/,/g, ".").replace(/[−–]/g, "-").replace(/×/g, "*").replace(/÷/g, "/").replace(/[+\-*/]+$/, "");
  if (!input || !/^[0-9.+*/%()\-]+$/.test(input)) throw new Error("Некорректное выражение");
  const tokens = input.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/%]/g) ?? [];
  if (tokens.join("") !== input) throw new Error("Некорректное выражение");
  let position = 0;
  const peek = () => tokens[position];
  const consume = () => tokens[position++];
  const primary = (): number => {
    if (peek() === "+" || peek() === "-") {
      const sign = consume();
      const value = primary();
      return sign === "-" ? -value : value;
    }
    if (peek() === "(") {
      consume();
      const value = expression();
      if (consume() !== ")") throw new Error("Не закрыта скобка");
      return value;
    }
    const token = consume();
    if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) throw new Error("Ожидается число");
    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error("Слишком большое число");
    return value;
  };
  const percent = (): number => {
    let value = primary();
    while (peek() === "%") { consume(); value /= 100; }
    return value;
  };
  const term = (): number => {
    let value = percent();
    while (peek() === "*" || peek() === "/") {
      const operator = consume();
      const right = percent();
      if (operator === "/" && right === 0) throw new Error("На ноль делить нельзя");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  };
  const expression = (): number => {
    let value = term();
    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const right = term();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };
  const result = expression();
  if (position !== tokens.length || !Number.isFinite(result)) throw new Error("Некорректное выражение");
  return result;
}

/** Adds thousands separators to each number without changing operators or decimal input. */
export function formatQuickExpression(source: string): string {
  return source.replace(/(?:\d+(?:[.,]\d*)?|[.,]\d+)/g, token => {
    const separator = token.includes(",") ? "," : token.includes(".") ? "." : "";
    const [wholePart, fraction] = separator ? token.split(separator) : [token, undefined];
    const whole = wholePart || "0";
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return fraction === undefined ? grouped : grouped + separator + fraction;
  });
}
