// ZXing's MultiFormatReader prints "MultiFormatReader: non-ReaderException from reader" for every camera
// frame that has no QR code in it. It's a library quirk (its exception classes fail `instanceof` after
// being compiled to ES5), not a real problem, but at several frames a second it buries the console.
// Only that one message is dropped; every other warning still goes through.
const original = console.warn;

console.warn = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].startsWith("MultiFormatReader: non-ReaderException")) return;
  original.apply(console, args);
};
