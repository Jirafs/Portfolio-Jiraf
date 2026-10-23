/* Catalog and pure cart calculations. */
(() => {
  const products = [
    {
      id: "t1",
      name: "Футболка Signal",
      type: "tee",
      price: 2400,
      art: "01",
      color: "#d4ed9b",
      sizes: ["S", "M", "L", "XL"],
    },
    {
      id: "h1",
      name: "Худи Frequency",
      type: "hoodie",
      price: 5900,
      art: "~",
      color: "#bbb4fa",
      sizes: ["S", "M", "L", "XL"],
    },
    {
      id: "b1",
      name: "Шопер Everyday",
      type: "bag",
      price: 1600,
      art: "P",
      color: "#e6d5be",
      sizes: ["ONE SIZE"],
    },
    {
      id: "t2",
      name: "Футболка Static",
      type: "tee",
      price: 2600,
      art: "//",
      color: "#c9d7e4",
      sizes: ["S", "M", "L", "XL"],
    },
    {
      id: "h2",
      name: "Худи Offline",
      type: "hoodie",
      price: 6200,
      art: "OFF",
      color: "#ecc9b9",
      sizes: ["S", "M", "L", "XL"],
    },
    {
      id: "b2",
      name: "Шопер Wave",
      type: "bag",
      price: 1800,
      art: "≈",
      color: "#dedcdb",
      sizes: ["ONE SIZE"],
    },
  ];

  function normalizeCart(value) {
    if (!Array.isArray(value)) return [];
    const rows = new Map();
    for (const item of value) {
      if (
        !item ||
        !products.some(
          (p) => p.id === item.id && p.sizes.includes(item.size),
        ) ||
        !Number.isInteger(item.qty) ||
        item.qty < 1 ||
        item.qty > 99
      )
        continue;
      const key = item.id + ":" + item.size;
      const old = rows.get(key);
      rows.set(key, {
        id: item.id,
        size: item.size,
        qty: Math.min(99, (old?.qty || 0) + item.qty),
      });
    }
    return [...rows.values()];
  }
  function totals(items, promo = "", deliveryValue = 0) {
    const cart = normalizeCart(items);
    const subtotal = cart.reduce(
      (sum, item) =>
        sum + products.find((p) => p.id === item.id).price * item.qty,
      0,
    );
    const discount =
      promo.trim().toUpperCase() === "PULSE10" ? Math.round(subtotal * 0.1) : 0;
    const delivery = cart.length && Number(deliveryValue) === 350 ? 350 : 0;
    return {
      subtotal,
      discount,
      delivery,
      total: subtotal - discount + delivery,
    };
  }
  function validOrder(order) {
    if (
      !order ||
      typeof order.id !== "string" ||
      !/^DEMO-[A-Z0-9]+$/.test(order.id) ||
      !Array.isArray(order.items) ||
      !order.items.length
    )
      return false;
    const normalized = normalizeCart(order.items);
    if (JSON.stringify(normalized) !== JSON.stringify(order.items))
      return false;
    const expected = totals(
      normalized,
      order.discount ? "PULSE10" : "",
      order.delivery,
    );
    return ["subtotal", "discount", "delivery", "total"].every(
      (key) => Number.isFinite(order[key]) && order[key] === expected[key],
    );
  }
  globalThis.PulseModel = { products, normalizeCart, totals, validOrder };
})();
