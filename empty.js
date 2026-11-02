// Universal recursive proxy stub for Node.js modules in browser bundles
function createRecursiveStub() {
  const fn = function () {
    return createRecursiveStub();
  };
  fn.prototype = {};

  const proxy = new Proxy(fn, {
    get(target, prop) {
      if (prop === "prototype") return fn.prototype;
      if (prop === "__esModule") return true;
      if (prop === "default") return proxy;
      if (prop === Symbol.toPrimitive) return () => "";
      if (prop === "toString") return () => "";
      if (prop === "valueOf") return () => 0;
      if (prop === "platform") return () => "browser";
      if (prop === "homedir") return () => "/home/user";
      if (prop === "join" || prop === "resolve") {
        return (...args) => args.filter(Boolean).join("/");
      }
      if (prop === "isIP" || prop === "isIPv4" || prop === "isIPv6") {
        return () => 0;
      }
      return createRecursiveStub();
    },
    apply() {
      return createRecursiveStub();
    },
    construct() {
      return {};
    },
  });

  return proxy;
}

module.exports = createRecursiveStub();
