import pino from "pino";

export function createLogger(debug = false) {
  return pino({
    level: debug ? "debug" : "info",
    base: undefined,
    transport: debug
      ? undefined
      : {
          target: "pino/file",
          options: { destination: 1 },
        },
  });
}
