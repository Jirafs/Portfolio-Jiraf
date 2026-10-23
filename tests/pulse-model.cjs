const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "../demos/pulse/cart-model.js"), "utf8"),
  ctx,
);
const M = ctx.PulseModel;
const cart = [
  { id: "t1", size: "M", qty: 2 },
  { id: "h1", size: "L", qty: 1 },
];
assert.equal(M.totals(cart, "PULSE10", 350).total, 9980);
assert.equal(M.totals(cart, "  pulse10 ", 350).discount, 1070);
assert.equal(M.totals([], "PULSE10", 350).total, 0);
assert.equal(
  M.normalizeCart([
    { id: "t1", size: "M", qty: 60 },
    { id: "t1", size: "M", qty: 60 },
  ])[0].qty,
  99,
);
assert.equal(
  M.normalizeCart([
    { id: "t1", size: "BAD", qty: 1 },
    { id: "no", size: "M", qty: 1 },
    null,
    { id: "t1", size: "M", qty: -1 },
  ]).length,
  0,
);
const order = {
  id: "DEMO-TEST",
  items: cart,
  ...M.totals(cart, "PULSE10", 350),
};
assert.equal(M.validOrder(order), true);
assert.equal(M.validOrder({ ...order, total: 1 }), false);
assert.equal(M.validOrder({ ...order, items: [...cart, cart[0]] }), false);
assert.equal(M.validOrder({ ...order, delivery: 999 }), false);
console.log(
  "PASS: Pulse size/quantity normalization, promo and delivery calculations, empty checkout and receipt integrity",
);
